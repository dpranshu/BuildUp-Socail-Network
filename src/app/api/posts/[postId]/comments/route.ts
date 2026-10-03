import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: post, error: postError } = await supabase.from("posts")
    .select("id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (postError) return NextResponse.json({ message: "Unable to load post." }, { status: 500 });
  if (!post) return NextResponse.json({ message: "Post not found." }, { status: 404 });
  const { data, error } = await supabase.from("comments")
    .select("id,author_id,parent_comment_id,body,created_at,author:profiles!comments_author_id_fkey(display_name,handle)")
    .eq("post_id", postId).order("created_at", { ascending: true }).limit(30);
  if (error) return NextResponse.json({ message: "Unable to load comments." }, { status: 500 });
  return NextResponse.json({ comments: data.map((item) => ({
    id: item.id, parentCommentId: item.parent_comment_id, body: item.body, author: item.author?.display_name ?? "Creator",
    handle: item.author?.handle ?? "@creator", createdAt: item.created_at, isMine: item.author_id === user?.id,
  })) });
}

export async function POST(request: Request, { params }: Context) {
  const { postId } = await params;
  let requestBody: { body?: unknown; parentCommentId?: unknown };
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Invalid comment request." }, { status: 400 });
    }
    requestBody = payload as { body?: unknown; parentCommentId?: unknown };
  } catch (error) {
    if (!(error instanceof SyntaxError)) console.error("Unable to read comment request:", error);
    return NextResponse.json({ message: "Invalid comment request." }, { status: 400 });
  }
  const content = typeof requestBody.body === "string" ? requestBody.body.trim() : "";
  if (!content || content.length > 1000) return NextResponse.json({ message: "Write a comment under 1,000 characters." }, { status: 400 });
  const parentCommentId = requestBody.parentCommentId === undefined || requestBody.parentCommentId === null
    ? null
    : typeof requestBody.parentCommentId === "string" ? requestBody.parentCommentId : "";
  if (parentCommentId === "" || (parentCommentId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parentCommentId))) {
    return NextResponse.json({ message: "Choose a valid comment to reply to." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to comment." }, { status: 401 });
  const { data: post, error: postError } = await supabase.from("posts")
    .select("id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (postError) return NextResponse.json({ message: "Unable to load post." }, { status: 500 });
  if (!post) return NextResponse.json({ message: "Post not found." }, { status: 404 });
  if (parentCommentId) {
    const { data: parentComment, error: parentError } = await supabase.from("comments")
      .select("id")
      .eq("id", parentCommentId)
      .eq("post_id", postId)
      .is("parent_comment_id", null)
      .maybeSingle();
    if (parentError) return NextResponse.json({ message: "Unable to verify the comment you’re replying to." }, { status: 500 });
    if (!parentComment) return NextResponse.json({ message: "That comment is no longer available to reply to." }, { status: 404 });
  }
  const { data, error } = await supabase.from("comments")
    .insert({ post_id: postId, author_id: user.id, parent_comment_id: parentCommentId, body: content })
    .select("id,author_id,parent_comment_id,body,created_at,author:profiles!comments_author_id_fkey(display_name,handle)").single();
  if (error) {
    console.error("Unable to add comment:", error.message, error.code);
    return NextResponse.json({ message: "Unable to add comment." }, { status: 500 });
  }
  const { data: updatedPost, error: countError } = await supabase.from("posts")
    .select("comments_count")
    .eq("id", postId)
    .maybeSingle();
  if (countError) console.error("Unable to read updated post comment count:", countError.message, countError.code);
  return NextResponse.json({ comment: {
    id: data.id, parentCommentId: data.parent_comment_id, body: data.body, author: data.author?.display_name ?? "Creator",
    handle: data.author?.handle ?? "@creator", createdAt: data.created_at, isMine: data.author_id === user.id,
  }, comments: updatedPost?.comments_count }, { status: 201 });
}