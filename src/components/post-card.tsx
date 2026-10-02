import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { Post } from "@/lib/types";

export function PostCard({
  post,
  headerActions,
  toolbar,
  actions,
  comments,
}: {
  post: Post;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  comments?: ReactNode;
}) {
  return (
    <article className="border-b hairline px-4 py-3 sm:px-0">
      <div className="flex items-center gap-3 px-0.5">
        <Link
          href={`/creator/${encodeURIComponent(post.handle)}`}
          aria-label={`View ${post.author}'s profile`}
          className="shrink-0"
        >
          <ProfileAvatar src={post.avatarUrl} alt="" className="h-10 w-10" iconSize={21} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
            <Link href={`/creator/${encodeURIComponent(post.handle)}`} className="truncate">{post.author}</Link>
            {post.isVerified && <BadgeCheck size={14} className="shrink-0 fill-[var(--blue)] text-[var(--blue)]" />}
          </div>
          <p className="truncate text-xs text-[var(--muted)]">{post.handle}</p>
        </div>
        {headerActions}
      </div>

      {toolbar}
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.55] text-[#eeeae5]">{post.body}</p>
      {post.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-x-2 text-[12px] text-[var(--blue)]">{post.tags.map((tag) => <span key={`${post.id}-${tag}`}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}</div>}
      {post.mediaUrls.map((url) => post.mediaType === "video"
        ? <video key={url} className="mt-3 max-h-[520px] w-full bg-black object-contain" controls playsInline src={url} />
        : <Image key={url} src={url} alt="Post attachment" width={1200} height={900} unoptimized className="mt-3 max-h-[520px] w-full bg-black object-cover" />)}

      {actions ?? (
        <div className="mt-1 flex items-center justify-between" aria-label="Post activity">
          <span className="post-action"><Heart size={18} /><span>{post.likes}</span></span>
          <span className="post-action"><MessageCircle size={18} /><span>{post.comments}</span></span>
          <span className="post-action"><Repeat2 size={18} /><span>{post.reposts}</span></span>
          <span className="post-action"><Share2 size={17} /></span>
        </div>
      )}
      {comments}
    </article>
  );
}