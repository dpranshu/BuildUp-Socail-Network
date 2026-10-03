"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import type { Comment } from "@/lib/types";

export function CommentThread({
  comments,
  deletingCommentId,
  onDelete,
  onReply,
}: {
  comments: Comment[];
  deletingCommentId: string | null;
  onDelete: (comment: Comment) => void;
  onReply: (parentCommentId: string, body: string) => Promise<boolean>;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const commentIds = new Set(comments.map((comment) => comment.id));
  const roots = comments.filter((comment) => !comment.parentCommentId || !commentIds.has(comment.parentCommentId));

  async function submitReply(event: FormEvent<HTMLFormElement>, commentId: string) {
    event.preventDefault();
    const body = replyDraft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (await onReply(commentId, body)) {
        setReplyDraft("");
        setReplyingTo(null);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {roots.map((comment) => {
        const replies = comments.filter((item) => item.parentCommentId === comment.id);
        return (
          <article key={comment.id} className="space-y-3">
            <CommentRow
              comment={comment}
              deleting={deletingCommentId === comment.id}
              onDelete={onDelete}
              onReply={() => {
                setReplyingTo((current) => current === comment.id ? null : comment.id);
                setReplyDraft("");
              }}
              replying={replyingTo === comment.id}
            />
            {replyingTo === comment.id && (
              <form className="ml-9 flex items-center gap-2" onSubmit={(event) => void submitReply(event, comment.id)}>
                <input
                  autoFocus
                  aria-label={`Reply to ${comment.author}`}
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  maxLength={1000}
                  placeholder={`Reply to ${comment.handle}`}
                  className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#77716b] focus:border-white/20"
                />
                <button type="submit" disabled={!replyDraft.trim() || sending} className="min-h-10 rounded-xl bg-white px-3 text-sm font-semibold text-[#141312] disabled:opacity-40">
                  {sending ? "Sending…" : "Reply"}
                </button>
              </form>
            )}
            {replies.length > 0 && (
              <div className="ml-4 space-y-3 border-l border-white/[0.1] pl-4 sm:ml-6 sm:pl-5">
                {replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    deleting={deletingCommentId === reply.id}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </article>
        );
      })}
      {comments.length === 0 && <p className="py-2 text-sm text-[var(--muted)]">No comments yet. Start the conversation.</p>}
    </div>
  );
}

function CommentRow({
  comment,
  deleting,
  onDelete,
  onReply,
  replying = false,
}: {
  comment: Comment;
  deleting: boolean;
  onDelete: (comment: Comment) => void;
  onReply?: () => void;
  replying?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-semibold text-white/80">
        {comment.author.trim().charAt(0).toUpperCase() || "C"}
      </span>
      <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.035] px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-white">{comment.author}</span>
          <span className="truncate text-xs text-[var(--muted)]">{comment.handle}</span>
          <time dateTime={comment.createdAt} className="ml-auto shrink-0 text-[11px] text-[var(--muted)]">
            {new Date(comment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">{comment.body}</p>
        <div className="mt-1.5 flex items-center gap-4">
          {onReply && (
            <button type="button" aria-expanded={replying} onClick={onReply} className="inline-flex min-h-7 items-center gap-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-white">
              <MessageCircle size={13} />
              Reply
            </button>
          )}
          {comment.isMine && (
            <button
              type="button"
              aria-label="Delete comment"
              title="Delete comment"
              disabled={deleting}
              onClick={() => onDelete(comment)}
              className="inline-flex min-h-7 items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-rose-300 disabled:opacity-50"
            >
              <Trash2 size={13} />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
