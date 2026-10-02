import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function POST(_request: Request, { params }: Context) {
  return setRepost(await params, true);
}

export async function DELETE(_request: Request, { params }: Context) {
  return setRepost(await params, false);
}

async function setRepost({ postId }: { postId: string }, reposted: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to repost." }, { status: 401 });
  const result = reposted
    ? await supabase.from("reposts").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await supabase.from("reposts").delete().eq("post_id", postId).eq("user_id", user.id);
  if (result.error) return NextResponse.json({ message: "Unable to update repost." }, { status: 500 });
  const { data: post, error } = await supabase.from("posts").select("reposts_count").eq("id", postId).single();
  if (error) return NextResponse.json({ message: "Post not found." }, { status: 404 });
  return NextResponse.json({ reposted, reposts: post.reposts_count });
}