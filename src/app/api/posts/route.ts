import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/api/feed", request.url));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: unknown;
      body?: unknown;
      tags?: unknown;
      mediaUrls?: unknown;
      mediaType?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.body === "string" ? body.body.trim() : "";
    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 8)
          .map((tag) => `#${tag}`)
      : [];
    const rawMediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls : [];
    if (rawMediaUrls.length > 4 || rawMediaUrls.some((url) => typeof url !== "string" || !/^https:\/\//i.test(url))) {
      return NextResponse.json({ message: "Use up to four valid HTTPS media links." }, { status: 400 });
    }
    const mediaUrls = rawMediaUrls as string[];
    const mediaType = body.mediaType === "image" || body.mediaType === "video" ? body.mediaType : "text";
    const postBody = [title, content].filter(Boolean).join("\n\n");

    if (!postBody || postBody.length > 5000 || title.length > 120 || content.length > 5000 || (mediaType !== "text" && mediaUrls.length === 0)) {
      return NextResponse.json(
        { message: "Add post text under 5,000 characters." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: "Sign in to publish a post." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({ author_id: user.id, body: postBody, tags, media_urls: mediaUrls, media_type: mediaType })
      .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle,avatar_url,is_verified)")
      .single();

    if (error) {
      return NextResponse.json({ message: "Unable to publish this post." }, { status: 500 });
    }

    const post = {
      id: data.id,
      authorId: data.author_id,
      author: data.author?.display_name ?? "Creator",
      handle: data.author?.handle ?? "@creator",
      avatarUrl: data.author?.avatar_url ?? null,
      isVerified: data.author?.is_verified ?? false,
      body: data.body,
      tags: data.tags,
      mediaUrls: data.media_urls,
      mediaType: data.media_type,
      likes: data.likes_count,
      comments: data.comments_count,
      reposts: data.reposts_count,
      createdAt: data.created_at,
      isMine: true,
      likedByMe: false,
      repostedByMe: false,
      commentsPreview: [],
    };

    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Invalid request body." },
      { status: 400 },
    );
  }
}
