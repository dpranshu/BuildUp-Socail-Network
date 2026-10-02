import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const mode = new URL(request.url).searchParams.get("mode");
  let followedIds: string[] | null = null;

  if (mode === "following") {
    if (!user) return NextResponse.json({ posts: [] });
    const { data: follows, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    if (followsError) return NextResponse.json({ message: "Unable to load followed creators." }, { status: 500 });
    followedIds = follows.map((follow) => follow.following_id);
    if (followedIds.length === 0) return NextResponse.json({ posts: [] });
  }

  let query = supabase
    .from("posts")
    .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle,avatar_url,is_verified)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (followedIds) query = query.in("author_id", followedIds);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "Unable to load the feed." }, { status: 500 });
  }

  const postIds = data.map((post) => post.id);
  const { data: myLikes } = user && postIds.length > 0
    ? await supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
    : { data: [] as { post_id: string }[] };
  const { data: myReposts } = user && postIds.length > 0
    ? await supabase.from("reposts").select("post_id").eq("user_id", user.id).in("post_id", postIds)
    : { data: [] as { post_id: string }[] };
  const likedIds = new Set((myLikes ?? []).map((like) => like.post_id));
  const repostedIds = new Set((myReposts ?? []).map((repost) => repost.post_id));

  const posts = data.map((post) => ({
    id: post.id,
    authorId: post.author_id,
    author: post.author?.display_name ?? "Creator",
    handle: post.author?.handle ?? "@creator",
    avatarUrl: post.author?.avatar_url ?? null,
    isVerified: post.author?.is_verified ?? false,
    body: post.body,
    tags: post.tags,
    mediaUrls: post.media_urls,
    mediaType: post.media_type,
    likes: post.likes_count,
    comments: post.comments_count,
    reposts: post.reposts_count,
    createdAt: post.created_at,
    isMine: user?.id === post.author_id,
    likedByMe: likedIds.has(post.id),
    repostedByMe: repostedIds.has(post.id),
    commentsPreview: [],
  }));

  return NextResponse.json({ posts });
}
