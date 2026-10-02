"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Repeat2, Share2, MoreHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import type { Comment, Post } from "@/lib/types";

type FeedMode = "for-you" | "following" | "latest";

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<FeedMode>("for-you");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [repostComposerPost, setRepostComposerPost] = useState<string | null>(null);
  const [repostDraft, setRepostDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedMode, setLoadedMode] = useState<FeedMode | null>(null);
  const loading = loadedMode !== mode;

  useEffect(() => {
    let active = true;
    fetch(`/api/feed?mode=${mode}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Unable to load feed.");
        if (active) setPosts(data.posts ?? []);
      })
      .catch(() => { if (active) setPosts([]); })
      .finally(() => { if (active) setLoadedMode(mode); });
    return () => { active = false; };
  }, [mode]);

  async function toggleLike(post: Post) {
    setNotice("");
    const liked = !post.likedByMe;
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, likedByMe: liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
      : item));
    try {
      const response = await fetch(`/api/posts/${post.id}/like`, { method: liked ? "POST" : "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        setNotice("Sign in to like posts.");
        router.push("/login");
      } else if (!response.ok) {
        throw new Error(data.message);
      } else {
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likes: data.likes } : item));
      }
    } catch {
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, likedByMe: post.likedByMe, likes: post.likes }
        : item));
      setNotice("Could not update like. Try again.");
    }
  }

  async function toggleComments(postId: string) {
    if (openComments === postId) {
      setOpenComments(null);
      return;
    }
    setOpenComments(postId);
    const response = await fetch(`/api/posts/${postId}/comments`);
    if (!response.ok) return;
    const data = await response.json();
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, commentsPreview: data.comments as Comment[] } : post));
  }

  async function toggleRepost(post: Post) {
    const reposted = !post.repostedByMe;
    if (reposted) {
      setRepostComposerPost(post.id);
      setRepostDraft("");
      return;
    }
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, repostedByMe: reposted, reposts: Math.max(0, item.reposts + (reposted ? 1 : -1)) }
      : item));
    try {
      const response = await fetch(`/api/posts/${post.id}/repost`, { method: reposted ? "POST" : "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
      } else if (!response.ok) {
        throw new Error(data.message);
      } else {
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, reposts: data.reposts } : item));
      }
    } catch {
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, repostedByMe: post.repostedByMe, reposts: post.reposts }
        : item));
      setNotice("Could not update repost. Try again.");
    }
  }

  async function submitRepost(post: Post) {
    setNotice("");
    try {
      const response = await fetch(`/api/posts/${post.id}/repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughts: repostDraft }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to repost.");
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, repostedByMe: true, reposts: data.reposts }
        : item));
      setRepostComposerPost(null);
      setRepostDraft("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update repost. Try again.");
    }
  }

  async function deletePost(post: Post) {
    if (!post.isMine || !window.confirm("Delete this post? This cannot be undone.")) return;
    const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("Could not delete post. Try again.");
      return;
    }
    setPosts((current) => current.filter((item) => item.id !== post.id));
    setMenuPost(null);
  }

  async function moderatePost(post: Post, action: "report" | "block" | "not_interested") {
    setNotice("");
    try {
      const response = await fetch(`/api/posts/${post.id}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to apply this action.");

      if (action === "block") {
        setPosts((current) => current.filter((item) => item.authorId !== post.authorId));
        setNotice(`Blocked ${post.author}. Their posts won't appear in your feed.`);
      } else if (action === "not_interested") {
        setPosts((current) => current.filter((item) => item.id !== post.id));
        setNotice("We’ll show you fewer posts like this.");
      } else {
        setNotice("Report sent for review.");
      }
      setMenuPost(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to apply this action.");
    }
  }

  async function submitComment(postId: string) {
    const body = commentDraft.trim();
    if (!body) return;
    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await response.json();
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setNotice(data.message ?? "Could not add comment.");
      return;
    }
    setPosts((current) => current.map((post) => post.id === postId
      ? { ...post, comments: post.comments + 1, commentsPreview: [...post.commentsPreview, data.comment] }
      : post));
    setCommentDraft("");
  }

  return (
    <AppShell title="Home">
      <div className="border-b hairline px-5 pt-2">
        <div role="tablist" aria-label="Feed" className="flex">
          {([["for-you", "For You"], ["following", "Following"], ["latest", "Latest"]] as const).map(([value, label]) => (
            <button key={value} role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className="feed-tab text-sm">{label}</button>
          ))}
        </div>
      </div>

      {notice && <p role="status" className="border-b hairline px-5 py-2 text-xs text-amber-300">{notice}</p>}
      <div>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            headerActions={<button type="button" title="More post actions" aria-label="More post actions" aria-haspopup="menu" aria-expanded={menuPost === post.id} onClick={() => setMenuPost((current) => current === post.id ? null : post.id)} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-white/5"><MoreHorizontal size={19} /></button>}
            toolbar={menuPost === post.id && (post.isMine ? (
              <button type="button" role="menuitem" onClick={() => void deletePost(post)} className="flex w-full items-center px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/[0.06]">Delete post</button>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => void moderatePost(post, "report")} className="flex w-full items-center px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]">Report post</button>
                <button type="button" role="menuitem" onClick={() => void moderatePost(post, "block")} className="flex w-full items-center px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]">Block {post.author}</button>
                <button type="button" role="menuitem" onClick={() => void moderatePost(post, "not_interested")} className="flex w-full items-center px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]">Not interested</button>
              </>
            ))}
            actions={
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button type="button" aria-label={post.likedByMe ? "Unlike post" : "Like post"} aria-pressed={post.likedByMe} onClick={() => void toggleLike(post)} className={`post-action ${post.likedByMe ? "post-action-liked" : ""}`}>
                    <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} /> <span>{post.likes}</span>
                  </button>
                  <button type="button" aria-label="Show comments" aria-expanded={openComments === post.id} onClick={() => void toggleComments(post.id)} className="post-action"><MessageCircle size={18} /><span>{post.comments}</span></button>
                  <button type="button" aria-label={post.repostedByMe ? "Undo repost" : "Repost"} aria-pressed={post.repostedByMe} onClick={() => void toggleRepost(post)} className={`post-action ${post.repostedByMe ? "text-[var(--blue)]" : ""}`}><Repeat2 size={18} /><span>{post.reposts}</span></button>
                </div>
                <button type="button" aria-label="Share post" title="Share" onClick={() => void navigator.clipboard?.writeText(window.location.origin + `/profile?post=${post.id}`)} className="post-action"><Share2 size={17} /></button>
              </div>
            }
            repostComposer={repostComposerPost === post.id && (
              <form className="mt-3 border-t hairline pt-3" onSubmit={(event) => { event.preventDefault(); void submitRepost(post); }}>
                <label className="block text-xs text-[var(--muted)]" htmlFor={`repost-thoughts-${post.id}`}>Add your thoughts <span className="text-[var(--muted)]">(optional)</span></label>
                <textarea id={`repost-thoughts-${post.id}`} value={repostDraft} onChange={(event) => setRepostDraft(event.target.value)} maxLength={500} rows={2} placeholder="What do you think about this?" className="mt-2 w-full resize-y bg-transparent text-sm text-white outline-none placeholder:text-[#77716b]" />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setRepostComposerPost(null)} className="min-h-8 px-3 text-xs text-[var(--muted)]">Cancel</button>
                  <button type="submit" className="min-h-8 rounded-full bg-[var(--blue)] px-4 text-xs font-semibold text-white">Repost</button>
                </div>
              </form>
            )}
            comments={openComments === post.id && (
              <div className="mt-2 border-t hairline pt-3">
                <div className="space-y-3">
                  {post.commentsPreview.map((comment) => <div key={comment.id} className="text-xs"><span className="font-semibold">{comment.author}</span><span className="ml-2 text-[var(--muted)]">{comment.body}</span></div>)}
                  {post.commentsPreview.length === 0 && <p className="text-xs text-[var(--muted)]">No comments yet.</p>}
                </div>
                <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitComment(post.id); }}>
                  <input aria-label="Write a comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Write a reply" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#77716b]" />
                  <button disabled={!commentDraft.trim()} className="text-xs font-semibold text-[var(--blue)] disabled:opacity-40">Reply</button>
                </form>
              </div>
            )}
          />
        ))}
        {!loading && posts.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-medium">Your timeline starts here.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Share what you&apos;re building, or explore the latest from creators.</p>
            <Link href="/create" className="mt-5 inline-flex min-h-10 items-center rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white">Write an update</Link>
          </div>
        )}
        {loading && <div className="space-y-3 px-4 py-5" aria-label="Loading feed"><div className="h-4 w-2/5 animate-pulse rounded bg-white/10" /><div className="h-20 animate-pulse rounded bg-white/[0.04]" /></div>}
      </div>
    </AppShell>
  );
}
