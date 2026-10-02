"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default function CreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
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
        body: JSON.stringify({ title, body, tags: tagList, mediaUrls: mediaUrlList, mediaType }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "Unable to publish your post.");
        return;
      }

      setTitle("");
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
      <div className="border-y hairline px-5 py-6 sm:border sm:bg-white/[0.025]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Post title</label>
            <input
              type="text"
              required={!body.trim()}
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What's the focus of your update?"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Content</label>
            <textarea
              rows={8}
              required={!title.trim()}
              maxLength={4900}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share what you're building, learning, or trying to figure out..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="#buildinpublic #creator #startup"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">Media type
              <select value={mediaType} onChange={(event) => setMediaType(event.target.value as typeof mediaType)} className="mt-2 min-h-11 w-full border hairline bg-[var(--surface)] px-3 text-sm text-white">
                <option value="text">Text only</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label className="block text-sm text-slate-300">Media URLs <span className="text-xs text-[var(--muted)]">(up to 4 HTTPS links, one per line)</span>
              <textarea rows={2} value={mediaUrls} onChange={(event) => setMediaUrls(event.target.value)} placeholder="https://…" className="mt-2 w-full resize-y border hairline bg-[var(--surface)] px-3 py-2 text-sm text-white outline-none placeholder:text-[#77716b]" />
            </label>
          </div>

          {message && <p role="alert" className="text-sm text-rose-300">{message}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--blue)] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Publishing..." : "Publish post"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
