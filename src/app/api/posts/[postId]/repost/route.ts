import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function POST(request: Request, { params }: Context) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid repost request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid repost request." }, { status: 400 });
  }
  const thoughtsValue = (body as { thoughts?: unknown }).thoughts;
  const thoughts = typeof thoughtsValue === "string" ? thoughtsValue.trim() : "";
  if (thoughtsValue !== undefined && typeof thoughtsValue !== "string") {
    return NextResponse.json({ message: "Repost thoughts must be text." }, { status: 400 });
  }
  if (thoughts.length > 500) {
    return NextResponse.json({ message: "Keep repost thoughts under 500 characters." }, { status: 400 });
  }
  return setRepost(await params, true, thoughts);
}

export async function DELETE(_request: Request, { params }: Context) {
  return setRepost(await params, false, "");
}

async function setRepost({ postId }: { postId: string }, reposted: boolean, thoughts: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to repost." }, { status: 401 });
  const { data: post, error: postError } = await supabase.from("posts")
    .select("reposts_count")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (postError) return NextResponse.json({ message: "Unable to load post." }, { status: 500 });
  if (!post) return NextResponse.json({ message: "Post not found." }, { status: 404 });
  let reposts = post.reposts_count;
  if (reposted) {
    const { data, error } = await supabase.from("reposts")
      .upsert({ post_id: postId, user_id: user.id, thoughts }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Unable to create repost:", error.message, error.code);
      return NextResponse.json({ message: "Unable to update repost." }, { status: 500 });
    }
    if (data) reposts += 1;
  } else {
    const { data, error } = await supabase.from("reposts")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .select("id");
    if (error) {
      console.error("Unable to delete repost:", error.message, error.code);
      return NextResponse.json({ message: "Unable to update repost." }, { status: 500 });
    }
    if (data?.length) reposts = Math.max(0, reposts - data.length);
  }
  return NextResponse.json({ reposted, reposts });
}