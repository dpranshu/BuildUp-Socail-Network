import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { postId } = await params;
    const body = (await request.json()) as { action?: unknown };
    const action = body.action;
    if (action !== "report" && action !== "block" && action !== "not_interested") {
      return NextResponse.json({ message: "Choose a valid post action." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to manage posts." }, { status: 401 });

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .is("deleted_at", null)
      .maybeSingle();
    if (postError) return NextResponse.json({ message: "Unable to load this post." }, { status: 500 });
    if (!post) return NextResponse.json({ message: "Post not found." }, { status: 404 });

    if (action !== "not_interested" && post.author_id === user.id) {
      return NextResponse.json({ message: "You cannot use this action on your own post." }, { status: 400 });
    }

    const result = action === "report"
      ? await supabase.from("post_reports").insert({ post_id: postId, reporter_id: user.id })
      : action === "block"
        ? await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: post.author_id })
        : await supabase.from("hidden_posts").insert({ user_id: user.id, post_id: postId });

    if (result.error?.code === "23505") return NextResponse.json({ ok: true, alreadyApplied: true });
    if (result.error) return NextResponse.json({ message: "Unable to apply this post action." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Invalid post action." }, { status: 400 });
  }
}