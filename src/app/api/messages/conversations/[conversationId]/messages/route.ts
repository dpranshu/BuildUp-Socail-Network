import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ conversationId: string }> };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: Request, { params }: Context) {
  const { conversationId } = await params;
  if (!isUuid(conversationId)) return NextResponse.json({ message: "Conversation not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to view messages." }, { status: 401 });

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) {
    console.error("Unable to check conversation access:", conversationError.message, conversationError.code);
    return NextResponse.json({ message: "Unable to load this conversation." }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ message: "Conversation not found." }, { status: 404 });

  const { data, error } = await supabase.from("messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Unable to load messages:", error.message, error.code);
    return NextResponse.json({ message: "Unable to load messages." }, { status: 500 });
  }
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { conversationId } = await params;
    if (!isUuid(conversationId)) return NextResponse.json({ message: "Conversation not found." }, { status: 404 });
    const payload = await request.json() as { body?: unknown };
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!body || body.length > 4000) {
      return NextResponse.json({ message: "Write a message under 4,000 characters." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to send messages." }, { status: 401 });

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError) {
      console.error("Unable to check conversation access:", conversationError.message, conversationError.code);
      return NextResponse.json({ message: "Unable to send this message." }, { status: 500 });
    }
    if (!conversation) return NextResponse.json({ message: "Conversation not found." }, { status: 404 });

    const { data, error } = await supabase.from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body })
      .select("id,conversation_id,sender_id,body,created_at")
      .single();
    if (error) {
      console.error("Unable to send message:", error.message, error.code);
      return NextResponse.json({ message: "Unable to send this message." }, { status: 500 });
    }
    return NextResponse.json({ message: data }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid message request." }, { status: 400 });
  }
}
