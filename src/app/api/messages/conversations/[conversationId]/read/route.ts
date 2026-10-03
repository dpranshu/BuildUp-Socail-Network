import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ conversationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: Context) {
  const { conversationId } = await params;
  if (!uuidPattern.test(conversationId)) {
    return NextResponse.json({ message: "Conversation not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to update message status." }, { status: 401 });

  const { error } = await supabase.from("conversation_reads").upsert({
    conversation_id: conversationId,
    user_id: user.id,
    last_read_at: new Date().toISOString(),
  }, { onConflict: "conversation_id,user_id" });
  if (error) {
    console.error("Unable to mark conversation read.", { code: error.code, message: error.message });
    return NextResponse.json({ message: "Unable to update message status." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
