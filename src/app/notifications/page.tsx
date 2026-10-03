"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Handshake, Heart, LoaderCircle, MessageCircle, MessageSquareText, Repeat2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { createClient } from "@/lib/supabase/client";

type NotificationType = "like" | "follow" | "comment" | "repost" | "collab_interest" | "collab_accepted" | "collab_declined" | "message";
type ActivityNotification = {
  id: string;
  actorId: string;
  type: NotificationType;
  postId: string | null;
  conversationId: string | null;
  createdAt: string;
  readAt: string | null;
  actor: { name: string; handle: string; avatarUrl: string | null };
  postText: string | null;
};
type ActivityCursor = { createdAt: string; id: string };

const notificationCopy: Record<NotificationType, string> = {
  like: "liked your post",
  follow: "started following you",
  comment: "commented on your post",
  repost: "reposted your post",
  collab_interest: "is interested in your opportunity",
  collab_accepted: "accepted your collaboration introduction",
  collab_declined: "responded to your collaboration introduction",
  message: "sent you a message",
};

const notificationIcons: Record<NotificationType, typeof Heart> = {
  like: Heart,
  follow: UserPlus,
  comment: MessageSquareText,
  repost: Repeat2,
  collab_interest: Handshake,
  collab_accepted: Handshake,
  collab_declined: Handshake,
  message: MessageCircle,
};

function notificationHref(notification: ActivityNotification) {
  if (notification.type === "message" && notification.conversationId) {
    return `/messages?conversation=${encodeURIComponent(notification.conversationId)}`;
  }
  if (notification.type === "follow") {
    return `/creator/${encodeURIComponent(notification.actor.handle)}`;
  }
  if (notification.type === "collab_interest") return "/collabs?view=mine";
  if (notification.type === "collab_accepted") {
    return `/messages?with=${encodeURIComponent(notification.actorId)}`;
  }
  if (notification.type === "collab_declined") return "/collabs";
  if (notification.postId) return `/feed#post-${encodeURIComponent(notification.postId)}`;
  return `/creator/${encodeURIComponent(notification.actor.handle)}`;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const delta = Math.max(0, Date.now() - date.getTime());
  if (delta < 60_000) return "now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  if (delta < 604_800_000) return `${Math.floor(delta / 86_400_000)}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<ActivityCursor | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotifications = useCallback(async (
    active: () => boolean = () => true,
    cursor?: ActivityCursor,
    append = false,
  ) => {
    try {
      const params = new URLSearchParams();
      if (cursor) {
        params.set("before", cursor.createdAt);
        params.set("before_id", cursor.id);
      }
      const response = await fetch(`/api/notifications${params.size ? `?${params}` : ""}`);
      const data = await response.json();
      if (response.status === 401) {
        if (active()) setSignedOut(true);
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to load notifications.");
      if (active()) {
        setSignedOut(false);
        setNotifications((current) => append
          ? [...current, ...(data.notifications ?? []).filter((item: ActivityNotification) => !current.some((existing) => existing.id === item.id))]
          : data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
        setHasMore(Boolean(data.hasMore));
        setNextCursor(data.nextCursor ?? null);
        setError("");
      }
    } catch (cause) {
      if (active()) setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally {
      if (active()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => loadNotifications(() => active));
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const queueRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void loadNotifications(() => active);
      }, 160);
    };

    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data.user?.id) return;
        const supabase = createClient();
        channel = supabase
          .channel(`notifications-page-${data.user.id}`)
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${data.user.id}`,
          }, queueRefresh)
          .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${data.user.id}`,
          }, queueRefresh)
          .subscribe((status, subscriptionError) => {
            if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && active) {
              console.error("Notifications Realtime subscription failed.", subscriptionError);
            }
          });
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to connect to notifications.");
      });

    return () => {
      active = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (channel) void createClient().removeChannel(channel);
    };
  }, [loadNotifications]);

  async function openNotification(notification: ActivityNotification) {
    if (!notification.readAt) {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Unable to update notification.");
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ));
        setUnreadCount((current) => Math.max(0, current - 1));
        window.dispatchEvent(new Event("buildup-unread-updated"));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to update notification.");
        return;
      }
    }
    router.push(notificationHref(notification));
  }

  async function markAllRead() {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to update notifications.");
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      setUnreadCount(0);
      window.dispatchEvent(new Event("buildup-unread-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update notifications.");
    }
  }

  async function loadOlderNotifications() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadNotifications(() => true, nextCursor, true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell title="Notifications">
      <section className="px-4 pb-12 pt-5 sm:px-0">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold">Notifications</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">Activity from your creator community.</p>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={() => void markAllRead()} className="min-h-9 rounded-full border hairline px-3 text-xs font-medium text-white hover:bg-white/[0.05]">
              Mark all read
            </button>
          )}
        </header>

        {error && <p role="alert" className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-300">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-16"><LoaderCircle size={21} className="animate-spin text-[var(--muted)]" /></div>
        ) : signedOut ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-[var(--muted)]">Sign in to view your notifications.</p>
            <Link href="/login" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white">Sign in</Link>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border hairline bg-white/[0.04] text-[var(--muted)]">
              <Bell size={21} strokeWidth={1.7} />
            </span>
            <p className="mt-4 text-sm font-medium">You’re all caught up.</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">Likes, new followers, messages, and collaboration activity will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type];
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`flex w-full items-start gap-3 px-2 py-4 text-left transition-colors hover:bg-white/[0.035] ${notification.readAt ? "" : "bg-white/[0.025]"}`}
                >
                  <span className="relative shrink-0">
                    <ProfileAvatar src={notification.actor.avatarUrl} alt="" className="h-11 w-11" iconSize={21} />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--blue)] text-white">
                      <Icon size={10} fill={notification.type === "like" ? "currentColor" : "none"} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-5">
                      <span className="font-semibold text-white">{notification.actor.name}</span>{" "}
                      <span className="text-[#c9c4bd]">{notificationCopy[notification.type]}</span>
                    </span>
                    {notification.postText && notification.type !== "follow" && notification.type !== "message" && (
                      <span className="mt-1 block truncate text-xs text-[var(--muted)]">{notification.postText}</span>
                    )}
                    <time className="mt-1 block text-[10px] text-[var(--muted)]" dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                  </span>
                  {!notification.readAt && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                </button>
              );
            })}
          </div>
        )}
        {!loading && !signedOut && hasMore && (
          <div className="flex justify-center py-5">
            <button type="button" disabled={loadingMore} onClick={() => void loadOlderNotifications()} className="inline-flex min-h-9 items-center gap-2 rounded-full border hairline px-4 text-xs font-medium text-white hover:bg-white/[0.05] disabled:opacity-60">
              {loadingMore && <LoaderCircle size={14} className="animate-spin" />}
              Load older activity
            </button>
          </div>
        )}
      </section>
    </AppShell>
  );
}
