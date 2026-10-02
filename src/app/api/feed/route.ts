import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const searchParams = new URL(request.url).searchParams;
  const mode = searchParams.get("mode");
  const requestedPageSize = Number(searchParams.get("page_size") ?? 6);
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, 10)
    : 6;
  const before = searchParams.get("before");
  const beforeId = searchParams.get("before_id");
  let cursorTime: string | null = null;

  if (before || beforeId) {
    const parsedTime = before ? new Date(before) : null;
    if (
      !parsedTime ||
      !Number.isFinite(parsedTime.getTime()) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(before ?? "") ||
      !beforeId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(beforeId)
    ) {
      return NextResponse.json({ message: "Invalid feed cursor." }, { status: 400 });
    }
    cursorTime = before;
  }

  let followedIds: string[] | null = null;

  if (mode === "following") {
    if (!user) return NextResponse.json({ posts: [], hasMore: false, nextCursor: null });
    const { data: follows, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    if (followsError) return NextResponse.json({ message: "Unable to load followed creators." }, { status: 500 });
    followedIds = follows.map((follow) => follow.following_id);
    if (followedIds.length === 0) return NextResponse.json({ posts: [], hasMore: false, nextCursor: null });
  }

  let blockedAuthorIds: string[] = [];
  let hiddenPostIds: string[] = [];
  if (user) {
    const [blocksResult, hiddenPostsResult] = await Promise.all([
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
      supabase.from("hidden_posts").select("post_id").eq("user_id", user.id),
    ]);
    if (blocksResult.error || hiddenPostsResult.error) {
      return NextResponse.json({ message: "Unable to apply your feed preferences." }, { status: 500 });
    }
    blockedAuthorIds = (blocksResult.data ?? []).map((block) => block.blocked_id);
    hiddenPostIds = (hiddenPostsResult.data ?? []).map((hiddenPost) => hiddenPost.post_id);
  }

  let query = supabase
    .from("posts")
    .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle,bio,avatar_url,is_verified)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  if (followedIds) query = query.in("author_id", followedIds);
  if (blockedAuthorIds.length > 0) query = query.not("author_id", "in", `(${blockedAuthorIds.join(",")})`);
  if (hiddenPostIds.length > 0) query = query.not("id", "in", `(${hiddenPostIds.join(",")})`);
  if (cursorTime && beforeId) {
    query = query.or(`created_at.lt.${cursorTime},and(created_at.eq.${cursorTime},id.lt.${beforeId})`);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "Unable to load the feed." }, { status: 500 });
  }

  const hasMore = data.length > pageSize;
  const page = data.slice(0, pageSize);
  const postIds = page.map((post) => post.id);
  const [likesResult, repostsResult] = user && postIds.length > 0
    ? await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
        supabase.from("reposts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      ])
    : [
        { data: [] as { post_id: string }[], error: null },
        { data: [] as { post_id: string }[], error: null },
      ];
  if (likesResult.error || repostsResult.error) {
      return NextResponse.json({ message: "Unable to load post reactions." }, { status: 500 });
  }
  const myLikes = likesResult.data;
  const myReposts = repostsResult.data;
  const likedIds = new Set((myLikes ?? []).map((like) => like.post_id));
  const repostedIds = new Set((myReposts ?? []).map((repost) => repost.post_id));

  const posts = page.map((post) => ({
    id: post.id,
    authorId: post.author_id,
    author: post.author?.display_name ?? "Creator",
    handle: post.author?.handle ?? "@creator",
    authorBio: post.author?.bio ?? "",
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

  const lastPost = page.at(-1);
  return NextResponse.json({
    posts,
    hasMore,
    nextCursor: hasMore && lastPost
      ? { createdAt: lastPost.created_at, id: lastPost.id }
      : null,
  });
}
