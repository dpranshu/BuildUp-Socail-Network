import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { Post } from "@/lib/types";

export function PostCard({
  post,
  id,
  authorHref,
  headerActions,
  toolbar,
  actions,
  repostComposer,
  comments,
}: {
  post: Post;
  id?: string;
  authorHref?: string;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  repostComposer?: ReactNode;
  comments?: ReactNode;
}) {
  const profileHref = authorHref ?? `/creator/${encodeURIComponent(post.handle)}`;

  return (
    <article id={id} className="relative mx-auto w-full max-w-[420px] border-b hairline px-4 py-3">
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
        <p className="mb-3 whitespace-pre-wrap text-[14px] leading-[1.55] text-[#eeeae5]">{post.repostInfo.thoughts}</p>
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
          <p className="truncate text-xs text-[var(--muted)]">{getBioPreview(post.authorBio)}</p>
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

      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.55] text-[#eeeae5]">{post.body}</p>
      {post.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-x-2 text-[12px] text-[var(--blue)]">{post.tags.map((tag) => <span key={`${post.id}-${tag}`}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}</div>}
      {post.mediaUrls.map((url) => post.mediaType === "video"
        ? <video key={url} className="mt-3 max-h-[520px] w-full bg-black object-contain" controls playsInline preload="none" src={url} />
        : <Image key={url} src={url} alt="Post attachment" width={1200} height={1200} unoptimized loading="lazy" className="mt-3 aspect-square w-full bg-black object-cover" />)}

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