import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { BadgeCheck, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getOpportunityLabel } from "@/lib/opportunities";
import type { Post } from "@/lib/types";

export function PostCard({
  post,
  id,
  authorHref,
  onDoubleTapLike,
  headerActions,
  toolbar,
  actions,
  repostComposer,
  comments,
}: {
  post: Post;
  id?: string;
  authorHref?: string;
  onDoubleTapLike?: () => void;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  repostComposer?: ReactNode;
  comments?: ReactNode;
}) {
  const profileHref = authorHref ?? `/creator/${encodeURIComponent(post.handle)}`;
  const captionRef = useRef<HTMLParagraphElement>(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionOverflows, setCaptionOverflows] = useState(false);
  const [likePop, setLikePop] = useState<{ x: number; y: number; key: number } | null>(null);
  const previousTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTouchLikeRef = useRef(0);
  const likePopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likePopKeyRef = useRef(0);
  const hasImageCaption = post.mediaType === "image" && post.mediaUrls.length > 0 && Boolean(post.body);

  function showLikePop(clientX: number, clientY: number, article: HTMLElement) {
    const bounds = article.getBoundingClientRect();
    setLikePop({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      key: ++likePopKeyRef.current,
    });
    if (likePopTimerRef.current) clearTimeout(likePopTimerRef.current);
    likePopTimerRef.current = setTimeout(() => setLikePop(null), 700);
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element
      && Boolean(target.closest("a, button, input, textarea, select, video, [role='button'], [role='menu'], [contenteditable='true']"));
  }

  function handleDoubleClick(event: MouseEvent<HTMLElement>) {
    if (isInteractiveTarget(event.target) || Date.now() - lastTouchLikeRef.current < 700) return;
    showLikePop(event.clientX, event.clientY, event.currentTarget);
    onDoubleTapLike?.();
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (!onDoubleTapLike || isInteractiveTarget(event.target)) {
      previousTapRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) return;

    const now = Date.now();
    const previousTap = previousTapRef.current;
    if (
      previousTap
      && now - previousTap.time <= 350
      && Math.hypot(touch.clientX - previousTap.x, touch.clientY - previousTap.y) <= 40
    ) {
      event.preventDefault();
      previousTapRef.current = null;
      lastTouchLikeRef.current = now;
      showLikePop(touch.clientX, touch.clientY, event.currentTarget);
      onDoubleTapLike();
      return;
    }

    previousTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
  }

  useEffect(() => {
    const caption = captionRef.current;
    if (!caption || !hasImageCaption || captionExpanded) return;

    const measureOverflow = () => {
      setCaptionOverflows(caption.scrollHeight > caption.clientHeight + 1);
    };

    measureOverflow();
    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(caption);
    return () => resizeObserver.disconnect();
  }, [captionExpanded, hasImageCaption, post.body]);

  useEffect(() => () => {
    if (likePopTimerRef.current) clearTimeout(likePopTimerRef.current);
  }, []);

  return (
    <article
      id={id}
      onDoubleClick={onDoubleTapLike ? handleDoubleClick : undefined}
      onTouchEnd={onDoubleTapLike ? handleTouchEnd : undefined}
      className={`relative mx-auto w-full max-w-[420px] border-b hairline px-4 py-3 md:max-w-[598px] ${onDoubleTapLike ? "touch-manipulation" : ""}`}
    >
      {likePop && (
        <span
          key={likePop.key}
          aria-hidden="true"
          className="pointer-events-none absolute z-20 text-rose-500 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] animate-post-like-pop"
          style={{ left: likePop.x, top: likePop.y, transform: "translate(-50%, -50%)" }}
        >
          <Heart size={76} strokeWidth={1.5} fill="currentColor" />
        </span>
      )}
      {post.repostInfo && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <Repeat2 size={14} />
          <Link href={`/creator/${encodeURIComponent(post.repostInfo.handle)}`} className="font-semibold text-[#d7d1ca]">
            {post.repostInfo.name}
          </Link>
          reposted
        </p>
      )}
      {post.repostInfo?.thoughts && (
        <p className="mb-3 whitespace-pre-wrap text-[14px] leading-[1.55] text-[#eeeae5] md:text-base">{post.repostInfo.thoughts}</p>
      )}
      {post.postKind === "opportunity" && (
        <p className="mb-2 inline-flex items-center rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--blue)]">
          Looking for · {getOpportunityLabel(post.opportunityKind)}
        </p>
      )}
      <div className="flex items-center gap-3 px-0.5">
        <Link
          href={profileHref}
          aria-label={`View ${post.author}'s profile`}
          className="shrink-0"
        >
          <ProfileAvatar src={post.avatarUrl} alt="" className="h-10 w-10" iconSize={21} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
            <Link href={profileHref} className="truncate">{post.author}</Link>
            {post.isVerified && <BadgeCheck size={14} className="shrink-0 fill-[var(--blue)] text-[var(--blue)]" />}
          </div>
          <p className="truncate text-xs text-[var(--muted)] md:text-[0.8rem]">{getBioPreview(post.authorBio)}</p>
        </div>
        {(headerActions || toolbar) && (
          <div className="relative shrink-0">
            {headerActions}
            {toolbar && (
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-48 overflow-hidden rounded-md border hairline bg-[var(--surface)] py-1 shadow-xl">
                {toolbar}
              </div>
            )}
          </div>
        )}
      </div>

      {post.body && (
        <div className="mt-2">
          <p
            ref={captionRef}
            id={`post-caption-${post.id}`}
            className={`whitespace-pre-wrap text-[14px] leading-[1.55] text-[#eeeae5] md:text-base ${
              hasImageCaption && !captionExpanded ? "line-clamp-2" : ""
            }`}
          >
            {post.body}
          </p>
          {hasImageCaption && (captionOverflows || captionExpanded) && (
            <button
              type="button"
              aria-controls={`post-caption-${post.id}`}
              aria-expanded={captionExpanded}
              onClick={() => setCaptionExpanded((expanded) => !expanded)}
              className="mt-0.5 text-sm font-medium text-[var(--muted)] hover:text-white"
            >
              {captionExpanded ? "less" : "…more"}
            </button>
          )}
        </div>
      )}
      {post.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-x-2 text-[12px] text-[var(--blue)]">{post.tags.map((tag) => <span key={`${post.id}-${tag}`}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}</div>}
      {post.mediaUrls.map((url) => post.mediaType === "video"
        ? <video key={url} className="mt-3 max-h-[520px] w-full bg-black object-contain" controls playsInline preload="none" src={url} />
        : <Image key={url} src={url} alt="Post attachment" width={1200} height={1200} unoptimized loading="lazy" className="mt-3 aspect-square w-full rounded-2xl bg-black object-cover" />)}

      {actions ?? (
        <div className="mt-1 flex items-center justify-between" aria-label="Post activity">
          <div className="flex items-center gap-3">
            <span className="post-action"><Heart size={18} /><span>{post.likes}</span></span>
            <span className="post-action"><MessageCircle size={18} /><span>{post.comments}</span></span>
            <span className="post-action"><Repeat2 size={18} /><span>{post.reposts}</span></span>
          </div>
          <span className="post-action"><Share2 size={17} /></span>
        </div>
      )}
      {repostComposer}
      {comments}
    </article>
  );
}

function getBioPreview(bio: string) {
  const normalizedBio = bio.trim().replace(/\s+/g, " ");
  if (!normalizedBio) return "No bio yet";
  if (normalizedBio.length <= 50) return normalizedBio;

  const preview = normalizedBio.slice(0, 50);
  const wordBoundary = preview.lastIndexOf(" ");
  return `${preview.slice(0, wordBoundary > 0 ? wordBoundary : preview.length).trimEnd()}...`;
}