import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const postImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxPostImageSize = 2 * 1024 * 1024;

const postSelect = "id,author_id,body,tags,media_urls,media_type,likes_count,comments_count,reposts_count,created_at,author:profiles!posts_author_id_fkey(display_name,handle,bio,avatar_url,is_verified)";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapPost(data: {
  id: string;
  author_id: string;
  body: string;
  tags: string[];
  media_urls: string[];
  media_type: "image" | "video" | "text";
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  created_at: string;
  author: { display_name: string; handle: string; bio: string | null; avatar_url: string | null; is_verified: boolean } | null;
}, userId: string) {
  return {
    id: data.id,
    authorId: data.author_id,
    author: data.author?.display_name ?? "Creator",
    handle: data.author?.handle ?? "@creator",
    authorBio: data.author?.bio ?? "",
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
    isMine: userId === data.author_id,
    likedByMe: false,
    repostedByMe: false,
    commentsPreview: [],
  };
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/api/feed", request.url));
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 3 * 1024 * 1024) {
    return NextResponse.json({ message: "The prepared image upload must be under 2 MB." }, { status: 413 });
  }

  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data") ?? false;
  let input: Record<string, unknown>;
  let imageFile: File | null = null;

  if (isMultipart) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }
    const imageValue = formData.get("image");
    if (imageValue && !(imageValue instanceof File)) {
      return NextResponse.json({ message: "Choose a valid image file." }, { status: 400 });
    }
    imageFile = imageValue instanceof File ? imageValue : null;
    const tagsValue = formData.get("tags");
    const mediaUrlsValue = formData.get("mediaUrls");
    try {
      input = {
        postId: formData.get("postId"),
        body: formData.get("body"),
        tags: typeof tagsValue === "string" ? JSON.parse(tagsValue) : [],
        mediaUrls: typeof mediaUrlsValue === "string" ? JSON.parse(mediaUrlsValue) : [],
        mediaType: formData.get("mediaType"),
      };
    } catch {
      return NextResponse.json({ message: "Invalid post details." }, { status: 400 });
    }
  } else {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }
    input = payload as Record<string, unknown>;
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.body === "string" ? input.body.trim() : "";
  const postId = typeof input.postId === "string" ? input.postId : null;
  if (postId && !uuidPattern.test(postId)) {
    return NextResponse.json({ message: "Invalid post identifier." }, { status: 400 });
  }
  const tags = Array.isArray(input.tags)
    ? input.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 8)
        .map((tag) => `#${tag}`)
    : [];
  const rawMediaUrls = Array.isArray(input.mediaUrls) ? input.mediaUrls : [];
  if (rawMediaUrls.length > (imageFile ? 3 : 4) || rawMediaUrls.some((url) => typeof url !== "string" || !/^https:\/\//i.test(url))) {
    return NextResponse.json({ message: "Use up to four valid HTTPS media links." }, { status: 400 });
  }
  const mediaUrls = rawMediaUrls as string[];
  const mediaType = imageFile || input.mediaType === "image"
    ? "image"
    : input.mediaType === "video" ? "video" : "text";
  const postBody = [title, content].filter(Boolean).join("\n\n");

  if (postBody.length > 5000 || title.length > 120 || content.length > 5000 || (!postBody && !imageFile && mediaUrls.length === 0) || (mediaType !== "text" && mediaUrls.length === 0 && !imageFile)) {
    return NextResponse.json(
      { message: "Add post text or an image. Text must be under 5,000 characters." },
      { status: 400 },
    );
  }

  if (imageFile) {
    const extension = postImageTypes[imageFile.type];
    if (!extension) {
      return NextResponse.json({ message: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
    }
    if (imageFile.size === 0 || imageFile.size > maxPostImageSize) {
      return NextResponse.json({ message: "Prepared images must be between 1 byte and 2 MB. Edit the crop and try again." }, { status: 413 });
    }

    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!(imageFile.type === "image/jpeg" && isJpeg)
      && !(imageFile.type === "image/png" && isPng)
      && !(imageFile.type === "image/webp" && isWebp)) {
      return NextResponse.json({ message: "The selected file is not a valid JPEG, PNG, or WebP image." }, { status: 400 });
    }
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Sign in to publish a post." }, { status: 401 });
  }

  if (postId) {
    const { data: existingPost, error: existingPostError } = await supabase
      .from("posts")
      .select(postSelect)
      .eq("id", postId)
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingPostError) {
      return NextResponse.json({ message: "Unable to check post status before retrying." }, { status: 500 });
    }
    if (existingPost) {
      return NextResponse.json({ post: mapPost(existingPost, user.id) }, { status: 201 });
    }
  }

  let uploadedObjectPath: string | null = null;
  let uploadedImageUrl: string | null = null;
  if (imageFile) {
    const extension = postImageTypes[imageFile.type];
    uploadedObjectPath = `${user.id}/posts/${crypto.randomUUID()}.${extension}`;
    const bucket = supabase.storage.from("avatars");
    const { error: uploadError } = await bucket.upload(uploadedObjectPath, imageFile, {
      cacheControl: "31536000",
      contentType: imageFile.type,
    });
    if (uploadError) {
      console.error("Post image upload failed.", {
        code: uploadError.name,
        statusCode: uploadError.statusCode,
        message: uploadError.message,
      });
      return NextResponse.json({ message: "Unable to upload your image. Please try again." }, { status: 500 });
    }
    uploadedImageUrl = bucket.getPublicUrl(uploadedObjectPath).data.publicUrl;
  }

  const allMediaUrls = uploadedImageUrl ? [uploadedImageUrl, ...mediaUrls] : mediaUrls;
  const { data, error } = await supabase
    .from("posts")
    .insert({ ...(postId ? { id: postId } : {}), author_id: user.id, body: postBody, tags, media_urls: allMediaUrls, media_type: mediaType })
    .select(postSelect)
    .single();

  if (error) {
    console.error("Post creation failed.", {
      code: error.code,
      message: error.message,
    });
    if (uploadedObjectPath) {
      const { error: cleanupError } = await supabase.storage.from("avatars").remove([uploadedObjectPath]);
      if (cleanupError) console.error("Failed to clean up a post image after post creation failed.", cleanupError);
    }
    return NextResponse.json({ message: "Your image was uploaded, but the post could not be saved. Please retry." }, { status: 500 });
  }

  return NextResponse.json({ post: mapPost(data, user.id) }, { status: 201 });
}
