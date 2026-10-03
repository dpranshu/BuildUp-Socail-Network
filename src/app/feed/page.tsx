"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Hash, Heart, Image as ImageIcon, LoaderCircle, MessageCircle, MoreHorizontal, Repeat2, Smile, Trash2, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SharePostButton } from "@/components/share-post-button";
import { usePostCountsRealtime } from "@/hooks/use-post-counts-realtime";
import { getPendingPosts, getServerPendingPosts, removePendingPost, subscribePendingPosts } from "@/lib/pending-posts";
import { POST_BODY_MAX_LENGTH, POST_DRAFT_MAX_LENGTH } from "@/lib/post-limits";
import type { Comment, Post } from "@/lib/types";

type FeedMode = "for-you" | "following" | "latest";
type FeedCursor = { createdAt: string; id: string };

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const pendingPosts = useSyncExternalStore(subscribePendingPosts, getPendingPosts, getServerPendingPosts);
  const [mode, setMode] = useState<FeedMode>("for-you");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [repostComposerPost, setRepostComposerPost] = useState<string | null>(null);
  const [repostDraft, setRepostDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerTags, setComposerTags] = useState("");
  const [showComposerTags, setShowComposerTags] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; avatarUrl: string | null } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const doubleTapLikePendingRef = useRef(new Set<string>());
  const [loadedMode, setLoadedMode] = useState<FeedMode | null>(null);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef(mode);
  const loading = loadedMode !== mode;
  const persistedPosts = posts.filter((post) => !pendingPosts.some((pending) => pending.post.id === post.id));

  usePostCountsRealtime(persistedPosts.map((post) => post.id), (postId, counts) => {
    setPosts((current) => current.map((post) => post.id === postId
      ? { ...post, ...counts }
      : post));
  });

  useEffect(() => {
    for (const pending of pendingPosts) {
      if (pending.status === "complete" && posts.some((post) => post.id === pending.post.id)) {
        removePendingPost(pending.id);
      }
    }
  }, [pendingPosts, posts]);

  useEffect(() => {
    let active = true;
    modeRef.current = mode;
    const params = new URLSearchParams({ mode, page_size: "6" });
    fetch(`/api/feed?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Unable to load feed.");
        if (active) {
          setNotice("");
          setPosts(data.posts ?? []);
          setNextCursor(data.nextCursor ?? null);
          setHasMore(Boolean(data.hasMore));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setPosts([]);
          setNextCursor(null);
          setHasMore(false);
          setNotice(error instanceof Error ? error.message : "Unable to load feed.");
        }
      })
      .finally(() => { if (active) setLoadedMode(mode); });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => {
        const data = await response.json();
        if (active && data.user?.id) {
          setCurrentUser({ id: data.user.id, avatarUrl: data.user.avatarUrl ?? null });
        }
      })
      .catch(() => {
        if (active) setCurrentUser(null);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 160;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [composerBody]);

  const loadMorePosts = useCallback(async () => {
    if (!hasMore || !nextCursor || loading || loadMoreRef.current) return;
    loadMoreRef.current = true;
    setLoadingMore(true);
    const requestMode = mode;
    const params = new URLSearchParams({
      mode: requestMode,
      page_size: "10",
      before: nextCursor.createdAt,
      before_id: nextCursor.id,
    });
    try {
      const response = await fetch(`/api/feed?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to load more posts.");
      if (modeRef.current === requestMode) {
        setPosts((current) => [...current, ...(data.posts ?? [])]);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (error) {
      if (modeRef.current === requestMode) {
        setNotice(error instanceof Error ? error.message : "Unable to load more posts.");
      }
    } finally {
      loadMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, mode, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMorePosts();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMorePosts, loading]);

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

  function likePostFromDoubleTap(post: Post) {
    if (post.likedByMe || doubleTapLikePendingRef.current.has(post.id)) return;
    doubleTapLikePendingRef.current.add(post.id);
    void toggleLike(post).finally(() => doubleTapLikePendingRef.current.delete(post.id));
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
    if (!post.isMine || !window.confirm("Delete this post from the app? It will no longer be visible, but its database record will be kept.")) return;
    setNotice("");
    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to hide this post.");
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setMenuPost(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to hide this post. Please try again.");
    }
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
      ? {
          ...post,
          comments: typeof data.comments === "number" ? data.comments : post.comments + 1,
          commentsPreview: [...post.commentsPreview, data.comment],
        }
      : post));
    setCommentDraft("");
  }

  async function deleteComment(postId: string, comment: Comment) {
    if (!comment.isMine || deletingCommentId) return;
    setDeletingCommentId(comment.id);
    setNotice("");
    try {
      const response = await fetch(`/api/posts/${postId}/comments/${comment.id}`, { method: "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to delete this comment.");
      setPosts((current) => current.map((post) => post.id === postId
        ? {
            ...post,
            comments: typeof data.comments === "number" ? data.comments : Math.max(0, post.comments - 1),
            commentsPreview: post.commentsPreview.filter((item) => item.id !== comment.id),
          }
        : post));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to delete this comment.");
    } finally {
      setDeletingCommentId(null);
    }
  }

  function openCreatePage(mediaType: "image" | "video") {
    window.sessionStorage.setItem("buildup-create-draft", composerBody);
    window.sessionStorage.setItem("buildup-create-media", mediaType);
    router.push("/create");
  }

  function appendComposerEmoji() {
    const emoji = "🙂";
    setComposerBody((body) => body.length + emoji.length <= POST_DRAFT_MAX_LENGTH ? `${body}${emoji}` : body);
  }

  async function publishTextPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composerBody.trim();
    if (!body || composerBody.length > POST_BODY_MAX_LENGTH || publishing) return;
    const tags = composerTags
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
    setPublishing(true);
    setNotice("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, tags, mediaUrls: [], mediaType: "text" }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to publish your post.");
      setPosts((current) => [data.post as Post, ...current.filter((post) => post.id !== data.post.id)]);
      setComposerBody("");
      setComposerTags("");
      setShowComposerTags(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to publish your post.");
    } finally {
      setPublishing(false);
    }
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

      {currentUser && (
        <form
          onSubmit={(event) => void publishTextPost(event)}
          className="mx-auto hidden w-full max-w-[420px] border-b hairline px-4 py-3 md:max-w-[598px] md:px-5 lg:block"
        >
          <div className="flex items-center gap-3">
            <Link href="/profile" aria-label="Your profile" className="shrink-0">
              <ProfileAvatar src={currentUser.avatarUrl} alt="" className="h-10 w-10" iconSize={21} />
            </Link>
            <label htmlFor="feed-composer-body" className="sr-only">Write a post</label>
            <textarea
              ref={composerRef}
              id="feed-composer-body"
              rows={1}
              maxLength={POST_DRAFT_MAX_LENGTH}
              value={composerBody}
              onChange={(event) => setComposerBody(event.target.value)}
              placeholder="What are you building, learning, or figuring out?"
              className="composer-scrollbar min-h-10 min-w-0 flex-1 resize-none overflow-y-hidden bg-transparent py-2 text-base text-white outline-none placeholder:text-[#77716b]"
            />
          </div>
          {showComposerTags && (
            <label className="ml-[52px] mt-2 block">
              <span className="sr-only">Add tags</span>
              <input
                value={composerTags}
                onChange={(event) => setComposerTags(event.target.value)}
                placeholder="Add tags, separated by spaces"
                className="w-full border-t hairline bg-transparent py-2 text-sm text-white outline-none placeholder:text-[#77716b]"
              />
            </label>
          )}
          <div className="mt-2 flex items-center justify-between pl-[48px]">
            <div className="flex items-center gap-1" role="group" aria-label="Post options">
              <button type="button" onClick={() => openCreatePage("image")} aria-label="Add image" title="Add image" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--blue)]">
                <ImageIcon size={19} />
              </button>
              <button type="button" onClick={() => openCreatePage("video")} aria-label="Add video" title="Add video" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--blue)]">
                <Video size={18} />
              </button>
              <button type="button" onClick={() => setShowComposerTags((visible) => !visible)} aria-label="Add tags" aria-pressed={showComposerTags} title="Add tags" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--blue)]">
                <Hash size={19} />
              </button>
              <button type="button" onClick={appendComposerEmoji} aria-label="Add emoji" title="Add emoji" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--blue)]">
                <Smile size={19} />
              </button>
            </div>
            {composerBody.length > POST_BODY_MAX_LENGTH && (
              <span role="alert" className="text-xs text-rose-300">
                Remove {composerBody.length - POST_BODY_MAX_LENGTH} characters to post.
              </span>
            )}
            <button
              type="submit"
              disabled={!composerBody.trim() || composerBody.length > POST_BODY_MAX_LENGTH || publishing}
              className="inline-flex h-9 min-w-[68px] items-center justify-center gap-2 rounded-full bg-[var(--blue)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing && <LoaderCircle size={15} className="animate-spin" />}
              Post
            </button>
          </div>
        </form>
      )}

      {notice && <p role="status" className="border-b hairline px-5 py-2 text-xs text-amber-300">{notice}</p>}
      <div>
        {pendingPosts.map((pending) => (
          <div key={pending.id}>
            <PostCard post={pending.post} authorHref="/profile" />
            <div className="mx-auto flex max-w-[420px] items-center justify-between gap-3 border-b hairline px-5 py-2 text-xs md:max-w-[598px]">
              {pending.status === "preparing" && (
                <span className="flex items-center gap-2 text-[var(--muted)]" role="status">
                  <LoaderCircle size={14} className="animate-spin" />
                  Preparing image…
                </span>
              )}
              {pending.status === "uploading" && (
                <span className="flex items-center gap-2 text-[var(--muted)]" role="status">
                  <LoaderCircle size={14} className="animate-spin" />
                  Uploading image in the background…
                </span>
              )}
              {pending.status === "complete" && <span role="status" className="text-emerald-300">Post published</span>}
              {pending.status === "failed" && (
                <>
                  <span role="alert" className="min-w-0 text-rose-300">{pending.message ?? "Image upload failed."}</span>
                  <button type="button" onClick={pending.retry} className="shrink-0 font-semibold text-white hover:text-[var(--blue)]">Retry</button>
                </>
              )}
            </div>
          </div>
        ))}
        {!loading && persistedPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
           id={`post-${post.id}`}
           onDoubleTapLike={() => likePostFromDoubleTap(post)}
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
                <SharePostButton post={post} />
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
                  {post.commentsPreview.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold">{comment.author}</span>
                        <span className="ml-2 text-[var(--muted)]">{comment.body}</span>
                      </div>
                      {comment.isMine && (
                        <button
                          type="button"
                          aria-label="Delete comment"
                          title="Delete comment"
                          disabled={deletingCommentId === comment.id}
                          onClick={() => void deleteComment(post.id, comment)}
                          className="shrink-0 text-[var(--muted)] hover:text-rose-300 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
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
        {!loading && posts.length === 0 && pendingPosts.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-medium">Your timeline starts here.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Share what you&apos;re building, or explore the latest from creators.</p>
            <Link href="/create" className="mt-5 inline-flex min-h-10 items-center rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white">Write an update</Link>
          </div>
        )}
        {loading && <div className="space-y-3 px-4 py-5" aria-label="Loading feed"><div className="h-4 w-2/5 animate-pulse rounded bg-white/10" /><div className="h-20 animate-pulse rounded bg-white/[0.04]" /></div>}
        {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
        {loadingMore && <div className="px-4 py-5 text-center text-xs text-[var(--muted)]" role="status">Loading more posts…</div>}
      </div>
    </AppShell>
  );
}
