import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const notificationSelect = "id,actor_id,notification_type,post_id,conversation_id,created_at,read_at,actor:profiles!notifications_actor_id_fkey(display_name,handle,avatar_url),post:posts!notifications_post_id_fkey(body)";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to view notifications." }, { status: 401 });

  if (new URL(request.url).searchParams.get("summary") === "1") {
    const [notificationsResult, conversationsResult] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id).is("read_at", null),
      supabase.from("conversations")
        .select("id,participant_one,participant_two,messages(id,sender_id,created_at)")
        .order("created_at", { ascending: false, referencedTable: "messages" })
        .limit(1, { referencedTable: "messages" })
        .limit(100),
    ]);
    if (notificationsResult.error || conversationsResult.error) {
      const error = notificationsResult.error ?? conversationsResult.error;
      console.error("Unable to load notification summary.", { code: error?.code, message: error?.message });
      return NextResponse.json({ message: "Unable to load activity status." }, { status: 500 });
    }

    const conversations = conversationsResult.data ?? [];
    const conversationIds = conversations.map((conversation) => conversation.id);
    const readsResult = conversationIds.length > 0
      ? await supabase.from("conversation_reads").select("conversation_id,last_read_at")
          .eq("user_id", user.id).in("conversation_id", conversationIds)
      : { data: [], error: null };
    if (readsResult.error) {
      console.error("Unable to load conversation read status.", { code: readsResult.error.code, message: readsResult.error.message });
      return NextResponse.json({ message: "Unable to load message status." }, { status: 500 });
    }

    const readAtByConversation = new Map((readsResult.data ?? []).map((read) => [read.conversation_id, read.last_read_at]));
    const unreadMessages = conversations.filter((conversation) => {
      const latestMessage = conversation.messages[0];
      if (!latestMessage || latestMessage.sender_id === user.id) return false;
      const readAt = readAtByConversation.get(conversation.id);
      return !readAt || latestMessage.created_at > readAt;
    }).length;

    return NextResponse.json({
      unreadNotifications: notificationsResult.count ?? 0,
      unreadMessages,
    });
  }

  const searchParams = new URL(request.url).searchParams;
  const before = searchParams.get("before");
  const beforeId = searchParams.get("before_id");
  if ((before && !beforeId) || (!before && beforeId)) {
    return NextResponse.json({ message: "Choose a valid activity cursor." }, { status: 400 });
  }
  let beforeIso: string | null = null;
  if (before && beforeId) {
    const beforeDate = new Date(before);
    if (!uuidPattern.test(beforeId) || Number.isNaN(beforeDate.getTime())) {
      return NextResponse.json({ message: "Choose a valid activity cursor." }, { status: 400 });
    }
    beforeIso = beforeDate.toISOString();
  }

  let listQuery = supabase.from("notifications")
    .select(notificationSelect)
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (beforeIso && beforeId) {
    listQuery = listQuery.or(`created_at.lt.${beforeIso},and(created_at.eq.${beforeIso},id.lt.${beforeId})`);
  }
  const [listResult, unreadCountResult] = await Promise.all([
    listQuery,
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id).is("read_at", null),
  ]);
  if (listResult.error || unreadCountResult.error) {
    const error = listResult.error ?? unreadCountResult.error;
    console.error("Unable to load notifications.", { code: error?.code, message: error?.message });
    return NextResponse.json({ message: "Unable to load notifications." }, { status: 500 });
  }

  const data = listResult.data;
  return NextResponse.json({
    unreadCount: unreadCountResult.count ?? 0,
    hasMore: data.length === 50,
    nextCursor: data.length === 50
      ? { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id }
      : null,
    notifications: data.map((notification) => ({
      id: notification.id,
      actorId: notification.actor_id,
      type: notification.notification_type,
      postId: notification.post_id,
      conversationId: notification.conversation_id,
      createdAt: notification.created_at,
      readAt: notification.read_at,
      actor: {
        name: notification.actor?.display_name ?? "A creator",
        handle: notification.actor?.handle ?? "@creator",
        avatarUrl: notification.actor?.avatar_url ?? null,
      },
      postText: notification.post?.body ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid notification update." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ message: "Invalid notification update." }, { status: 400 });
  }
  const body = input as { id?: unknown; all?: unknown };
  if (body.all !== true && (typeof body.id !== "string" || !uuidPattern.test(body.id))) {
    return NextResponse.json({ message: "Choose a valid notification." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to update notifications." }, { status: 401 });

  const query = supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (body.all === true) {
    const { error } = await query;
    if (error) {
      console.error("Unable to mark notifications read.", { code: error.code, message: error.message });
      return NextResponse.json({ message: "Unable to update notifications." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await query.eq("id", body.id as string).select("id").maybeSingle();
  if (error) {
    console.error("Unable to mark notifications read.", { code: error.code, message: error.message });
    return NextResponse.json({ message: "Unable to update notifications." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
