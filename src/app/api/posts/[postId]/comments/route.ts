import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("comments")
    .select("id,body,created_at,author:profiles!comments_author_id_fkey(display_name,handle)")
    .eq("post_id", postId).order("created_at", { ascending: true }).limit(30);
  if (error) return NextResponse.json({ message: "Unable to load comments." }, { status: 500 });
  return NextResponse.json({ comments: data.map((item) => ({
    id: item.id, body: item.body, author: item.author?.display_name ?? "Creator",
    handle: item.author?.handle ?? "@creator", createdAt: item.created_at,
  })) });
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { postId } = await params;
    const body = (await request.json()) as { body?: unknown };
    const content = typeof body.body === "string" ? body.body.trim() : "";
    if (!content || content.length > 1000) return NextResponse.json({ message: "Write a comment under 1,000 characters." }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to comment." }, { status: 401 });
    const { data, error } = await supabase.from("comments")
      .insert({ post_id: postId, author_id: user.id, body: content })
      .select("id,body,created_at,author:profiles!comments_author_id_fkey(display_name,handle)").single();
    if (error) return NextResponse.json({ message: "Unable to add comment." }, { status: 500 });
    return NextResponse.json({ comment: {
      id: data.id, body: data.body, author: data.author?.display_name ?? "Creator",
      handle: data.author?.handle ?? "@creator", createdAt: data.created_at,
    } }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid comment request." }, { status: 400 });
  }
}