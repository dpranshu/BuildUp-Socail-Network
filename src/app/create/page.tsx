"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Hash, Image as ImageIcon, Send, Trash2, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { compressPostImage, PostImageEditor, type PostImageSelection } from "@/components/post-image-editor";
import { addPendingPost, removePendingPost, updatePendingPost } from "@/lib/pending-posts";
import { POST_BODY_MAX_LENGTH, POST_DRAFT_MAX_LENGTH } from "@/lib/post-limits";
import type { Post } from "@/lib/types";

export default function CreatePage() {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const imagePreviewTransferredRef = useRef(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [imageSelection, setImageSelection] = useState<PostImageSelection | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (!imagePreviewTransferredRef.current && imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }
  }, []);

  useEffect(() => {
    const savedBody = window.sessionStorage.getItem("buildup-create-draft");
    const savedMediaType = window.sessionStorage.getItem("buildup-create-media");
    if (savedBody !== null) {
      window.sessionStorage.removeItem("buildup-create-draft");
    }
    if (savedMediaType === "image" || savedMediaType === "video") {
      window.sessionStorage.removeItem("buildup-create-media");
    }
    if (savedBody !== null || savedMediaType === "image" || savedMediaType === "video") {
      window.setTimeout(() => {
        if (savedBody !== null) setBody(savedBody);
        if (savedMediaType === "image" || savedMediaType === "video") setMediaType(savedMediaType);
      }, 0);
    }
  }, []);

  function selectImage(file: File | null) {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    const previewUrl = file ? URL.createObjectURL(file) : null;
    imagePreviewUrlRef.current = previewUrl;
    setImagePreview(previewUrl);
  }

  function clearImage() {
    selectImage(null);
    setImageSelection(null);
    setEditingFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (body.length > POST_BODY_MAX_LENGTH) return;

    const tagList = tags
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
    const mediaUrlList = mediaUrls.split(/\s+/).map((url) => url.trim()).filter(Boolean);

    if (mediaType === "image" && imageSelection) {
      const postId = crypto.randomUUID();
      const temporaryId = `pending-${postId}`;
      const previewUrl = imagePreviewUrlRef.current;
      if (!previewUrl) {
        setMessage("Preview your image again before publishing.");
        return;
      }
      const selection = imageSelection;
      const optimisticPost: Post = {
        id: temporaryId,
        authorId: "",
        author: "You",
        handle: "@you",
        authorBio: "",
        avatarUrl: null,
        isVerified: false,
        body: body.trim(),
        tags: tagList.map((tag) => `#${tag}`),
        likes: 0,
        comments: 0,
        reposts: 0,
        mediaUrls: [previewUrl],
        mediaType: "image",
        createdAt: new Date().toISOString(),
        isMine: true,
        likedByMe: false,
        repostedByMe: false,
        commentsPreview: [],
      };

      const publishImage = async () => {
        updatePendingPost(temporaryId, { status: "preparing", message: undefined });
        try {
          const compressedFile = await compressPostImage(selection);
          const formData = new FormData();
          formData.set("postId", postId);
          formData.set("body", body);
          formData.set("tags", JSON.stringify(tagList));
          formData.set("mediaUrls", JSON.stringify(mediaUrlList));
          formData.set("mediaType", "image");
          formData.set("image", compressedFile);
          updatePendingPost(temporaryId, { status: "uploading" });

          let lastError: Error = new Error("Unable to reach the server.");
          for (let attempt = 0; attempt < 3; attempt += 1) {
            let response: Response;
            try {
              response = await fetch("/api/posts", {
                method: "POST",
                body: formData,
                signal: AbortSignal.timeout(90_000),
              });
            } catch (error) {
              lastError = error instanceof Error && error.name === "TimeoutError"
                ? new Error("The upload timed out. Check your connection and retry.")
                : new Error("Unable to reach the server. Check your connection and retry.");
              if (attempt < 2) {
                await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)));
                continue;
              }
              throw lastError;
            }

            let result: { message?: string; post?: Post };
            try {
              result = await response.json();
            } catch {
              lastError = new Error("The server response was interrupted. Retrying the upload.");
              if (attempt < 2) {
                await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)));
                continue;
              }
              throw lastError;
            }
            if (response.status === 401) {
              removePendingPost(temporaryId);
              router.push("/login");
              return;
            }
            if (!response.ok) {
              lastError = new Error(result.message ?? "Unable to publish your post.");
              const canRetry = response.status === 408
                || response.status === 429
                || response.status >= 500;
              if (canRetry && attempt < 2) {
                await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)));
                continue;
              }
              throw lastError;
            }
            if (!result.post || typeof result.post !== "object") {
              throw new Error("The post was saved, but the server did not return it. Retry to check its status.");
            }
            updatePendingPost(temporaryId, {
              post: result.post,
              status: "complete",
              retry: () => {},
            });
            return;
          }
          throw lastError;
        } catch (error) {
          updatePendingPost(temporaryId, {
            status: "failed",
            message: error instanceof Error ? error.message : "Unable to publish your post.",
          });
        }
      };

      addPendingPost({
        id: temporaryId,
        post: optimisticPost,
        status: "preparing",
        retry: () => { void publishImage(); },
      });
      imagePreviewTransferredRef.current = true;
      router.push("/feed");
      void publishImage();
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("body", body);
    formData.set("tags", JSON.stringify(tagList));
    formData.set("mediaUrls", JSON.stringify(mediaUrlList));
    formData.set("mediaType", mediaType);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "Unable to publish your post.");
        return;
      }

      setBody("");
      setTags("");
      setMediaUrls("");
      clearImage();
      setMediaType("text");
      router.push("/feed");
      router.refresh();
    } catch {
      setMessage("Unable to reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Create post">
      <form onSubmit={handleSubmit} className="px-5 sm:px-0">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            setMessage("");
            if (file) setEditingFile(file);
            event.currentTarget.value = "";
          }}
        />
        <div className="flex items-center justify-between border-b hairline py-4">
          <h1 className="font-display text-lg font-semibold">Create a post</h1>
          {body.length > POST_BODY_MAX_LENGTH && (
            <span role="alert" className="text-xs text-rose-300">
              Remove {body.length - POST_BODY_MAX_LENGTH} characters to post.
            </span>
          )}
        </div>

        <label htmlFor="post-body" className="sr-only">Post text</label>
        <textarea
          id="post-body"
          rows={2}
          maxLength={POST_DRAFT_MAX_LENGTH}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What are you building, learning, or figuring out?"
          className="min-h-[110px] w-full resize-y bg-transparent py-4 text-[15px] leading-7 text-white outline-none placeholder:text-[#77716b]"
        />

        {mediaType === "image" && imagePreview && (
          <div className="my-3 overflow-hidden rounded-lg border hairline bg-black">
            <div className="relative">
              <Image src={imagePreview} alt="Selected post image preview" width={1200} height={1200} unoptimized className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove selected image"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t hairline px-3 py-2">
              <span className="text-xs text-[var(--muted)]">Crop ready · compressed after publishing</span>
              <button
                type="button"
                onClick={() => setEditingFile(imageSelection?.source ?? null)}
                className="rounded px-2 py-1 text-xs font-medium text-white hover:bg-white/[0.08]"
              >
                Edit crop
              </button>
            </div>
          </div>
        )}

        {mediaType === "video" && (
          <label className="my-3 block text-xs text-[var(--muted)]">
            Video URL
            <textarea
              rows={2}
              value={mediaUrls}
              onChange={(event) => setMediaUrls(event.target.value)}
              placeholder="https://"
              className="mt-2 block w-full resize-y border hairline bg-[var(--surface)] px-3 py-2 text-sm text-white outline-none placeholder:text-[#77716b] focus:border-[var(--blue)]"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline py-3">
          <div className="flex items-center gap-1" role="group" aria-label="Post type">
            {([
              ["text", "Text", FileText],
              ["image", "Image", ImageIcon],
              ["video", "Video", Video],
            ] as const).map(([type, label, Icon]) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                aria-pressed={mediaType === type}
                onClick={() => {
                  if (type === "image") {
                    setMediaType("image");
                    imageInputRef.current?.click();
                  } else {
                    setMediaType(type);
                    clearImage();
                    if (type === "text") setMediaUrls("");
                  }
                }}
                className={`flex h-9 items-center gap-2 rounded-md px-3 text-xs ${mediaType === type ? "bg-white/[0.1] text-white" : "text-[var(--muted)] hover:bg-white/[0.05] hover:text-white"}`}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("post-tags")?.focus()}
            aria-label="Add tags"
            title="Add tags"
            className="flex h-9 items-center gap-2 rounded-md px-3 text-xs text-[var(--muted)] hover:bg-white/[0.05] hover:text-white"
          >
            <Hash size={16} strokeWidth={1.8} />
            <span>Tags</span>
          </button>
        </div>

        <label htmlFor="post-tags" className="sr-only">Tags</label>
        <input
          id="post-tags"
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Add tags, separated by spaces"
          className="w-full border-t hairline bg-transparent py-3 text-sm text-white outline-none placeholder:text-[#77716b]"
        />

        {message && <p role="alert" className="border-t hairline py-3 text-sm text-rose-300">{message}</p>}

        <div className="flex justify-end border-t hairline py-4">
          <button
            type="submit"
            disabled={submitting
              || body.length > POST_BODY_MAX_LENGTH
              || (!body.trim() && !imageSelection && !mediaUrls.trim())
              || (mediaType === "image" && !imageSelection)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--blue)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={15} />
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
      {editingFile && (
        <PostImageEditor
          key={`${editingFile.name}-${editingFile.lastModified}-${editingFile.size}`}
          file={editingFile}
          onCancel={() => setEditingFile(null)}
          onSave={(selection) => {
            setImageSelection(selection);
            selectImage(selection.preview);
            setEditingFile(null);
          }}
        />
      )}
    </AppShell>
  );
}
