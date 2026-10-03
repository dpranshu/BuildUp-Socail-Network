import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string; commentId: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: Context) {
  const { postId, commentId } = await params;
  if (!uuidPattern.test(postId) || !uuidPattern.test(commentId)) {
    return NextResponse.json({ message: "Comment not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to delete your comment." }, { status: 401 });

  const { data: deletedComment, error } = await supabase.from("comments")
    .delete()
    .eq("id", commentId)
    .eq("post_id", postId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to delete comment:", error.message, error.code);
    return NextResponse.json({ message: "Unable to delete this comment." }, { status: 500 });
  }
  if (!deletedComment) {
    return NextResponse.json({ message: "Comment not found or you can no longer delete it." }, { status: 404 });
  }

  const { data: post, error: countError } = await supabase.from("posts")
    .select("comments_count")
    .eq("id", postId)
    .maybeSingle();
  if (countError) console.error("Unable to read updated post comment count:", countError.message, countError.code);

  return NextResponse.json({ ok: true, comments: post?.comments_count });
}
