import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ postId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to delete a post." }, { status: 401 });
  if (authError) {
    console.error("Unable to verify the user while hiding a post.", authError);
    return NextResponse.json({ message: "Unable to verify your account. Please try again." }, { status: 500 });
  }

  const { data: post, error: lookupError } = await supabase.from("posts")
    .select("id")
    .eq("id", postId)
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) {
    console.error("Unable to find the post to hide.", lookupError);
    return NextResponse.json({ message: "Unable to hide this post. Please try again." }, { status: 500 });
  }
  if (!post) return NextResponse.json({ message: "This post is already hidden or is not yours." }, { status: 404 });

  const { error: updateError } = await supabase.from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", user.id)
    .is("deleted_at", null);
  if (updateError) {
    console.error("Unable to soft-delete the post.", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
    if (updateError.code === "42501") {
      return NextResponse.json(
        { message: "Your post could not be hidden. Refresh the page and try again." },
        { status: 403 },
      );
    }
    return NextResponse.json({ message: "Unable to hide this post. Please try again." }, { status: 500 });
  }

  const { data: stillVisiblePost, error: verificationError } = await supabase.from("posts")
    .select("id")
    .eq("id", postId)
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (verificationError) {
    console.error("Unable to verify that the post was hidden.", verificationError);
    return NextResponse.json({ message: "Unable to confirm that this post was hidden. Refresh and check again." }, { status: 500 });
  }
  if (stillVisiblePost) {
    return NextResponse.json(
      { message: "Your post is still visible. Refresh the page and try again." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, hidden: true });
}