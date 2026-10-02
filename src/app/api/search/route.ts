import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")
    ?.trim()
    .replace(/[^\p{L}\p{N}_@.\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ creators: [], posts: [] });

  const supabase = await createClient();
  const [{ data: { user } }, creatorResult, postResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles")
      .select("id,display_name,handle,role,bio,avatar_url,is_verified,followers_count")
      .or(`display_name.ilike.%${query}%,handle.ilike.%${query}%`)
      .order("followers_count", { ascending: false })
      .limit(20),
    supabase.from("posts")
      .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle)")
      .ilike("body", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (creatorResult.error || postResult.error) {
    return NextResponse.json({ message: "Search is temporarily unavailable." }, { status: 500 });
  }

  const creatorIds = creatorResult.data.map((creator) => creator.id);
  const followingResult = user && creatorIds.length
    ? await supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", creatorIds)
    : { data: [] as { following_id: string }[], error: null };
  if (followingResult.error) return NextResponse.json({ message: "Unable to load follow state." }, { status: 500 });
  const followingIds = new Set((followingResult.data ?? []).map((item) => item.following_id));

  return NextResponse.json({
    creators: creatorResult.data.map((creator) => ({
      id: creator.id,
      name: creator.display_name,
      handle: creator.handle,
      role: creator.role,
      bio: creator.bio,
      avatarUrl: creator.avatar_url,
      verified: creator.is_verified,
      followers: creator.followers_count,
      isFollowing: followingIds.has(creator.id),
      isMine: user?.id === creator.id,
    })),
    posts: postResult.data.map((post) => ({
      id: post.id,
      authorId: post.author_id,
      author: post.author?.display_name ?? "Creator",
      handle: post.author?.handle ?? "@creator",
      body: post.body,
      tags: post.tags,
      mediaUrls: post.media_urls,
      mediaType: post.media_type,
      likes: post.likes_count,
      comments: post.comments_count,
      reposts: post.reposts_count,
      createdAt: post.created_at,
      isMine: user?.id === post.author_id,
    })),
  });
}
