import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  participant_one: string;
  participant_two: string;
  created_at: string;
  messages: Array<{
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
  }>;
};

function messagingUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to view your messages." }, { status: 401 });

  const { data, error } = await supabase
    .from("conversations")
    .select("id,participant_one,participant_two,created_at,messages(id,body,sender_id,created_at)")
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(1, { referencedTable: "messages" })
    .limit(50);

  if (error) {
    console.error("Unable to load conversations:", error.message, error.code);
    return NextResponse.json({
      message: messagingUnavailable(error)
        ? "Messaging is not set up yet. Apply the messaging database migration."
        : "Unable to load conversations.",
    }, { status: 500 });
  }

  const conversations = (data ?? []) as ConversationRow[];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const readsResult = conversationIds.length > 0
    ? await supabase.from("conversation_reads").select("conversation_id,last_read_at")
        .eq("user_id", user.id).in("conversation_id", conversationIds)
    : { data: [], error: null };
  if (readsResult.error) {
    console.error("Unable to load conversation read status:", readsResult.error.message, readsResult.error.code);
    return NextResponse.json({ message: "Unable to load message status." }, { status: 500 });
  }
  const readAtByConversation = new Map((readsResult.data ?? []).map((read) => [read.conversation_id, read.last_read_at]));

  const profileIds = [...new Set(conversations.map((conversation) =>
    conversation.participant_one === user.id ? conversation.participant_two : conversation.participant_one,
  ))];
  const profilesResult = profileIds.length > 0
    ? await supabase.from("profiles")
        .select("id,display_name,handle,avatar_url,is_verified")
        .in("id", profileIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    console.error("Unable to load conversation participants:", profilesResult.error.message, profilesResult.error.code);
    return NextResponse.json({ message: "Unable to load conversation participants." }, { status: 500 });
  }

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const result = conversations.flatMap((conversation) => {
    const participantId = conversation.participant_one === user.id
      ? conversation.participant_two
      : conversation.participant_one;
    const profile = profilesById.get(participantId);
    if (!profile) return [];
    const latestMessage = conversation.messages[0] ?? null;
    const readAt = readAtByConversation.get(conversation.id);
    return [{
      id: conversation.id,
      createdAt: conversation.created_at,
      isUnread: Boolean(
        latestMessage
        && latestMessage.sender_id === participantId
        && (!readAt || latestMessage.created_at > readAt),
      ),
      participant: {
        id: profile.id,
        name: profile.display_name,
        handle: profile.handle,
        avatarUrl: profile.avatar_url,
        isVerified: profile.is_verified,
      },
      latestMessage,
    }];
  }).sort((a, b) => {
    const aTime = a.latestMessage?.created_at ?? a.createdAt;
    const bTime = b.latestMessage?.created_at ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });

  return NextResponse.json({ conversations: result });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { profileId?: unknown };
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
      return NextResponse.json({ message: "Choose a valid profile to message." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to start a conversation." }, { status: 401 });
    if (profileId === user.id) return NextResponse.json({ message: "You cannot message yourself." }, { status: 400 });

    const { data: recipient, error: recipientError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (recipientError) {
      console.error("Unable to look up message recipient:", recipientError.message, recipientError.code);
      return NextResponse.json({ message: "Unable to find that profile." }, { status: 500 });
    }
    if (!recipient) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

    const [participantOne, participantTwo] = [user.id, profileId].sort();
    const findConversation = () => supabase
      .from("conversations")
      .select("id")
      .eq("participant_one", participantOne)
      .eq("participant_two", participantTwo)
      .maybeSingle();

    const existing = await findConversation();
    if (existing.error) {
      console.error("Unable to find conversation:", existing.error.message, existing.error.code);
      return NextResponse.json({
        message: messagingUnavailable(existing.error)
          ? "Messaging is not set up yet. Apply the messaging database migration."
          : "Unable to start a conversation.",
      }, { status: 500 });
    }
    if (existing.data) return NextResponse.json({ conversationId: existing.data.id });

    const created = await supabase.from("conversations")
      .insert({ participant_one: participantOne, participant_two: participantTwo })
      .select("id")
      .single();
    if (!created.error) return NextResponse.json({ conversationId: created.data.id }, { status: 201 });

    if (created.error.code === "23505") {
      const raced = await findConversation();
      if (!raced.error && raced.data) return NextResponse.json({ conversationId: raced.data.id });
    }

    console.error("Unable to create conversation:", created.error.message, created.error.code);
    return NextResponse.json({
      message: messagingUnavailable(created.error)
        ? "Messaging is not set up yet. Apply the messaging database migration."
        : "Unable to start a conversation.",
    }, { status: 500 });
  } catch {
    return NextResponse.json({ message: "Invalid conversation request." }, { status: 400 });
  }
}
