import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function POST(_request: Request, { params }: Context) {
  return setLike(await params, true);
}

export async function DELETE(_request: Request, { params }: Context) {
  return setLike(await params, false);
}

async function setLike({ postId }: { postId: string }, liked: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to like posts." }, { status: 401 });
  const { data: post, error: postError } = await supabase.from("posts")
    .select("likes_count")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (postError) return NextResponse.json({ message: "Unable to load post." }, { status: 500 });
  if (!post) return NextResponse.json({ message: "Post not found." }, { status: 404 });
  const result = liked
    ? await supabase.from("likes").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
  if (result.error) {
    console.error("Unable to update like:", result.error.message, result.error.code);
    return NextResponse.json({ message: "Unable to update like." }, { status: 500 });
  }
  const { data: updatedPost, error: countError } = await supabase.from("posts")
    .select("likes_count")
    .eq("id", postId)
    .maybeSingle();
  if (countError) console.error("Unable to read updated post like count:", countError.message, countError.code);
  return NextResponse.json({
    liked,
    likes: updatedPost?.likes_count ?? Math.max(0, post.likes_count + (liked ? 1 : -1)),
  });
}