"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Hash, Image as ImageIcon, Send, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function CreatePage() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const tagList = tags
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
    const mediaUrlList = mediaUrls.split(/\s+/).map((url) => url.trim()).filter(Boolean);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, tags: tagList, mediaUrls: mediaUrlList, mediaType }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "Unable to publish your post.");
        return;
      }

      setBody("");
      setTags("");
      setMediaUrls("");
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
        <div className="flex items-center justify-between border-b hairline py-4">
          <h1 className="font-display text-lg font-semibold">Create a post</h1>
          <span className="text-xs text-[var(--muted)]">{body.length}/5000</span>
        </div>

        <label htmlFor="post-body" className="sr-only">Post text</label>
        <textarea
          id="post-body"
          rows={12}
          required
          maxLength={5000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What are you building, learning, or figuring out?"
          className="min-h-[280px] w-full resize-y bg-transparent py-5 text-[15px] leading-7 text-white outline-none placeholder:text-[#77716b]"
        />

        {mediaType !== "text" && (
          <label className="block border-t hairline py-4 text-xs text-[var(--muted)]">
            {mediaType === "image" ? "Image URL" : "Video URL"}
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
                  setMediaType(type);
                  if (type === "text") setMediaUrls("");
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
            disabled={submitting || !body.trim()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--blue)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={15} />
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
