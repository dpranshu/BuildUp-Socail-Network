import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const handle = new URL(request.url).searchParams.get("handle");
  if (!handle && !user) return NextResponse.json({ message: "Sign in to view your profile." }, { status: 401 });

  const profileQuery = supabase
    .from("profiles")
    .select("id,display_name,handle,pronouns,role,bio,backstory,location,age,height,avatar_url,is_verified,followers_count,following_count,skills,interests,created_at");
  const profileResult = handle
    ? await profileQuery.eq("handle", handle).maybeSingle()
    : await profileQuery.eq("id", user!.id).maybeSingle();

  if (profileResult.error) return NextResponse.json({ message: "Unable to load profile." }, { status: 500 });
  if (!profileResult.data) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

  const profileId = profileResult.data.id;
  const isOwnProfile = user?.id === profileId;
  const profile = profileResult.data;
  const avatarUrl = profile.avatar_url ?? (isOwnProfile ? user?.user_metadata.avatar_url ?? user?.user_metadata.picture ?? null : null);
  const section = new URL(request.url).searchParams.get("section");

  if (section === "details") {
    const [postsCount, projectsResult, followerCount, followingCount, followResult] = await Promise.all([
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", profileId)
        .is("deleted_at", null),
      supabase
        .from("shipped_projects")
        .select("id,title,description,link,badge,created_at")
        .eq("owner_id", profileId)
        .order("created_at", { ascending: false }),
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profileId),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profileId),
      user && !isOwnProfile
        ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", profileId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (postsCount.error || projectsResult.error || followerCount.error || followingCount.error || followResult.error) {
      return NextResponse.json({ message: "Unable to load profile details." }, { status: 500 });
    }

    return NextResponse.json({
      details: {
        stats: {
          followers: followerCount.count ?? profile.followers_count ?? 0,
          following: followingCount.count ?? profile.following_count ?? 0,
          posts: postsCount.count ?? 0,
          projects: projectsResult.data.length,
        },
        projects: projectsResult.data.map((project) => ({
          id: project.id,
          title: project.title,
          description: project.description,
          link: project.link,
          badge: project.badge,
          createdAt: project.created_at,
        })),
        isFollowing: Boolean(followResult.data),
      },
    });
  }

  if (section === "posts") {
    const [postsResult, profileRepostsResult] = await Promise.all([
      supabase
        .from("posts")
        .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at")
        .eq("author_id", profileId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("reposts").select("id,post_id,thoughts,created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (postsResult.error || profileRepostsResult.error) {
      return NextResponse.json({ message: "Unable to load profile posts." }, { status: 500 });
    }

    const repostedPostIds = profileRepostsResult.data.map((repost) => repost.post_id);
    const repostedPostsResult = repostedPostIds.length > 0
      ? await supabase.from("posts")
          .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle,bio,avatar_url,is_verified)")
          .in("id", repostedPostIds)
          .is("deleted_at", null)
      : { data: [], error: null };
    if (repostedPostsResult.error) {
      return NextResponse.json({ message: "Unable to load profile reposts." }, { status: 500 });
    }

    const postIds = [...new Set([...postsResult.data.map((post) => post.id), ...repostedPostsResult.data.map((post) => post.id)])];
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
    const likedIds = new Set(likesResult.data.map((item) => item.post_id));
    const repostedIds = new Set(repostsResult.data.map((item) => item.post_id));
    const sourcePostsById = new Map(repostedPostsResult.data.map((post) => [post.id, post]));
    const profilePosts = postsResult.data.map((post) => ({
      id: post.id,
      authorId: post.author_id,
      author: profile.display_name,
      handle: profile.handle,
      authorBio: profile.bio,
      avatarUrl,
      isVerified: profile.is_verified,
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
    const profileReposts = profileRepostsResult.data.flatMap((repost) => {
      const post = sourcePostsById.get(repost.post_id);
      if (!post) return [];
      return [{
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
        createdAt: repost.created_at,
        isMine: user?.id === post.author_id,
        likedByMe: likedIds.has(post.id),
        repostedByMe: repostedIds.has(post.id),
        repostInfo: { name: profile.display_name, handle: profile.handle, thoughts: repost.thoughts },
        commentsPreview: [],
      }];
    });

    return NextResponse.json({
      profile: {
        id: profile.id,
        name: profile.display_name,
        handle: profile.handle,
        role: profile.role,
        bio: profile.bio,
        pronouns: profile.pronouns,
        backstory: profile.backstory,
        location: profile.location,
        age: profile.age,
        height: profile.height,
        avatarUrl,
        isVerified: profile.is_verified,
        isOwnProfile,
        isAuthenticated: Boolean(user),
        skills: profile.skills,
        interests: profile.interests,
        createdAt: profile.created_at,
        stats: {
          followers: profile.followers_count ?? 0,
          following: profile.following_count ?? 0,
          posts: 0,
          projects: 0,
        },
        posts: [...profilePosts, ...profileReposts]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 30),
        projects: [],
        isFollowing: false,
      },
    });
  }

  const [postsCount, postsResult, projectsResult, followerCount, followingCount, followResult, profileRepostsResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", profileId)
      .is("deleted_at", null),
    supabase
      .from("posts")
      .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at")
      .eq("author_id", profileId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("shipped_projects")
      .select("id,title,description,link,badge,created_at")
      .eq("owner_id", profileId)
      .order("created_at", { ascending: false }),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profileId),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profileId),
    user && !isOwnProfile
      ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", profileId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("reposts").select("id,post_id,thoughts,created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(30),
  ]);

  if (postsCount.error || postsResult.error || projectsResult.error || followerCount.error || followingCount.error || followResult.error || profileRepostsResult.error) {
    return NextResponse.json({ message: "Unable to load your profile." }, { status: 500 });
  }

  const repostedPostIds = profileRepostsResult.data.map((repost) => repost.post_id);
  const repostedPostsResult = repostedPostIds.length > 0
    ? await supabase.from("posts")
        .select("id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle,bio,avatar_url,is_verified)")
        .in("id", repostedPostIds)
        .is("deleted_at", null)
    : { data: [], error: null };
  if (repostedPostsResult.error) return NextResponse.json({ message: "Unable to load reposts." }, { status: 500 });

  const postIds = [...new Set([...postsResult.data.map((post) => post.id), ...repostedPostsResult.data.map((post) => post.id)])];
  const [likesResult, repostsResult] = user && postIds.length > 0
    ? await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
        supabase.from("reposts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      ])
    : [{ data: [] as { post_id: string }[], error: null }, { data: [] as { post_id: string }[], error: null }];
  if (likesResult.error || repostsResult.error) return NextResponse.json({ message: "Unable to load post reactions." }, { status: 500 });
  const likedIds = new Set((likesResult.data ?? []).map((item) => item.post_id));
  const repostedIds = new Set((repostsResult.data ?? []).map((item) => item.post_id));
  const sourcePostsById = new Map(repostedPostsResult.data.map((post) => [post.id, post]));

  const profilePosts = postsResult.data.map((post) => ({
    id: post.id,
    authorId: post.author_id,
    author: profile.display_name,
    handle: profile.handle,
    authorBio: profile.bio,
    avatarUrl,
    isVerified: profile.is_verified,
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
  const profileReposts = profileRepostsResult.data.flatMap((repost) => {
    const post = sourcePostsById.get(repost.post_id);
    if (!post) return [];
    return [{
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
      createdAt: repost.created_at,
      isMine: user?.id === post.author_id,
      likedByMe: likedIds.has(post.id),
      repostedByMe: repostedIds.has(post.id),
      repostInfo: { name: profile.display_name, handle: profile.handle, thoughts: repost.thoughts },
      commentsPreview: [],
    }];
  });

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.display_name,
      handle: profile.handle,
      role: profile.role,
      bio: profile.bio,
      pronouns: profile.pronouns,
      backstory: profile.backstory,
      location: profile.location,
      age: profile.age,
      height: profile.height,
      avatarUrl,
      isVerified: profile.is_verified,
      isOwnProfile,
      isAuthenticated: Boolean(user),
      skills: profile.skills,
      interests: profile.interests,
      createdAt: profile.created_at,
      stats: {
        followers: profile.followers_count ?? followerCount.count ?? 0,
        following: profile.following_count ?? followingCount.count ?? 0,
        posts: postsCount.count ?? 0,
        projects: projectsResult.data.length,
      },
      posts: [...profilePosts, ...profileReposts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30),
      projects: projectsResult.data.map((project) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        link: project.link,
        badge: project.badge,
        createdAt: project.created_at,
      })),
      isFollowing: Boolean(followResult.data),
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const field of ["display_name", "pronouns", "role", "bio", "backstory", "location", "age", "height", "avatar_url"]) {
      if (field in body) updates[field] = body[field];
    }
    if ("handle" in body) {
      if (typeof body.handle !== "string") {
        return NextResponse.json({ message: "Enter a valid username." }, { status: 400 });
      }
      const username = body.handle.trim().replace(/^@+/, "").toLowerCase();
      if (!/^[a-z0-9._-]{2,39}$/.test(username)) {
        return NextResponse.json({ message: "Use 2-39 letters, numbers, periods, underscores, or hyphens." }, { status: 400 });
      }
      updates.handle = `@${username}`;
    }
    for (const field of ["skills", "interests"]) {
      if (Array.isArray(body[field])) updates[field] = body[field].filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 20);
    }

    if (typeof updates.display_name === "string") updates.display_name = updates.display_name.trim().slice(0, 80);
    if (typeof updates.role === "string") updates.role = updates.role.trim().slice(0, 80);
    if (typeof updates.bio === "string") updates.bio = updates.bio.trim().slice(0, 500);
    if (typeof updates.backstory === "string") updates.backstory = updates.backstory.trim().slice(0, 1500);
    if (typeof updates.pronouns === "string") updates.pronouns = updates.pronouns.trim().slice(0, 40);
    if (typeof updates.location === "string") updates.location = updates.location.trim().slice(0, 120);
    if (typeof updates.height === "string") updates.height = updates.height.trim().slice(0, 24);
    if (typeof updates.avatar_url === "string" && updates.avatar_url && !/^https:\/\//i.test(updates.avatar_url)) {
      return NextResponse.json({ message: "Avatar URL must start with https://" }, { status: 400 });
    }
    if (typeof updates.age === "string") updates.age = updates.age ? Number.parseInt(updates.age, 10) : null;
    if (typeof updates.age === "number" && (!Number.isInteger(updates.age) || updates.age < 13 || updates.age > 120)) {
      return NextResponse.json({ message: "Age must be between 13 and 120." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to edit your profile." }, { status: 401 });

    if (typeof updates.handle === "string") {
      const { data: existingHandle, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", updates.handle)
        .neq("id", user.id)
        .maybeSingle();
      if (lookupError) return NextResponse.json({ message: "Unable to check username availability." }, { status: 500 });
      if (existingHandle) return NextResponse.json({ message: "That username is already taken." }, { status: 409 });
    }

    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update(updates as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", user.id)
      .select("handle")
      .maybeSingle();
    if (error?.code === "23505") return NextResponse.json({ message: "That username is already taken." }, { status: 409 });
    if (error) return NextResponse.json({ message: "Unable to update profile." }, { status: 500 });
    return NextResponse.json({ ok: true, handle: updatedProfile?.handle });
  } catch {
    return NextResponse.json({ message: "Invalid profile update." }, { status: 400 });
  }
}
