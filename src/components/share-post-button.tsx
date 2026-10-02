"use client";

import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Mail, MessageCircle, Send, Share2, X } from "lucide-react";
import type { Post } from "@/lib/types";

export function SharePostButton({ post }: { post: Post }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");

  function getPostUrl() {
    const url = new URL(`/creator/${encodeURIComponent(post.handle)}`, window.location.origin);
    url.searchParams.set("post", post.id);
    return url.toString();
  }

  function getShareText() {
    return [post.body.trim(), getPostUrl()].filter(Boolean).join("\n\n");
  }

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  async function copyText(text: string, successMessage: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStatus(successMessage);
        return;
      }
      window.prompt("Copy this text:", text);
    } catch (error) {
      setStatus(error instanceof Error ? `Could not copy: ${error.message}` : "Could not copy this text.");
    }
  }

  async function shareWithApps() {
    if (!navigator.share) {
      setStatus("Your browser does not support the system share menu. Choose an app below.");
      return;
    }
    try {
      await navigator.share({
        title: `${post.author} on Buildup`,
        text: post.body.slice(0, 180),
        url: getPostUrl(),
      });
      setIsOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(error instanceof Error ? `Could not open sharing: ${error.message}` : "Could not open sharing.");
    }
  }

  async function saveImage(imageUrl: string, index: number) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
      const blob = await response.blob();
      const extension = blob.type.split("/")[1]?.split(";")[0] || "jpg";
      const filename = `buildup-${post.id}-${index + 1}.${extension}`;
      const imageFile = new File([blob], filename, { type: blob.type || "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [imageFile] })) {
        try {
          await navigator.share({ files: [imageFile], title: `${post.author} on Buildup` });
          setStatus("Image shared. Choose Save Image or Photos in your device’s share menu to add it to your gallery.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setStatus("Image download started. Open the downloaded image and choose Save to Photos/Gallery if your browser does not do it automatically.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download this image.");
    }
  }

  return (
    <>
      <button type="button" aria-label="Share post" title="Share" onClick={() => { setStatus(""); setIsOpen(true); }} className="post-action">
        <Share2 size={17} />
      </button>
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-3 sm:items-center"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`share-post-title-${post.id}`}
            className="w-full max-w-md rounded-2xl border hairline bg-[var(--surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`share-post-title-${post.id}`} className="text-lg font-semibold text-white">Share post</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Send this post to a messaging app or copy its link.</p>
              </div>
              <button type="button" aria-label="Close share menu" onClick={() => setIsOpen(false)} className="rounded-full p-2 text-[var(--muted)] hover:bg-white/5 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void shareWithApps()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--blue)] px-3 text-sm font-semibold text-white hover:brightness-110">
                <Share2 size={16} /> More apps
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(getShareText())}`} target="_blank" rel="noreferrer" onClick={() => setIsOpen(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border hairline px-3 text-sm font-medium text-white hover:bg-white/5">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(getPostUrl())}&text=${encodeURIComponent(post.body)}`} target="_blank" rel="noreferrer" onClick={() => setIsOpen(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border hairline px-3 text-sm font-medium text-white hover:bg-white/5">
                <Send size={16} /> Telegram
              </a>
              <button
                type="button"
                onClick={() => {
                  window.open("https://discord.com/app", "_blank", "noopener,noreferrer");
                  void copyText(getShareText(), "Post text and link copied. Paste them into Discord.");
                }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border hairline px-3 text-sm font-medium text-white hover:bg-white/5"
              >
                <ExternalLink size={16} /> Discord
              </button>
              <a href={`mailto:?subject=${encodeURIComponent(`${post.author} on Buildup`)}&body=${encodeURIComponent(getShareText())}`} onClick={() => setIsOpen(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border hairline px-3 text-sm font-medium text-white hover:bg-white/5">
                <Mail size={16} /> Email
              </a>
              <button type="button" onClick={() => void copyText(getPostUrl(), "Post link copied.")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border hairline px-3 text-sm font-medium text-white hover:bg-white/5">
                <Copy size={16} /> Copy link
              </button>
            </div>

            {post.mediaType === "image" && post.mediaUrls.length > 0 && (
              <div className="mt-4 border-t hairline pt-4">
                <p className="mb-2 text-xs font-medium text-[var(--muted)]">Save to your device</p>
                <div className="flex flex-wrap gap-2">
                  {post.mediaUrls.map((imageUrl, index) => (
                    <button key={`${imageUrl}-${index}`} type="button" onClick={() => void saveImage(imageUrl, index)} className="flex min-h-10 items-center gap-2 rounded-xl border hairline px-3 text-sm text-white hover:bg-white/5">
                      <Download size={16} /> {post.mediaUrls.length > 1 ? `Save image ${index + 1}` : "Save image"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {status && <p role="status" className="mt-4 text-sm text-[var(--blue)]">{status}</p>}
          </section>
        </div>
      )}
    </>
  );
}
