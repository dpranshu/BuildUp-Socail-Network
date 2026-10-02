import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to delete a post." }, { status: 401 });

  const { data: post, error: lookupError } = await supabase.from("posts")
    .select("id")
    .eq("id", postId)
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ message: "Unable to delete post." }, { status: 500 });
  if (!post) return NextResponse.json({ message: "Post not found or not yours to delete." }, { status: 404 });

  const { error } = await supabase.from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", user.id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ message: "Unable to delete post." }, { status: 500 });
  return NextResponse.json({ ok: true });
}