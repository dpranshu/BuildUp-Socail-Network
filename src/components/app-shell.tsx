"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Ban, Bell, Handshake, House, LogOut, MessageCircle, Plus, Search, Settings } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/feed", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/collabs", label: "Collabs", icon: Handshake },
  { href: "/create", label: "Create", icon: Plus },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [hiddenChromePathname, setHiddenChromePathname] = useState<string | null>(null);
  const unreadRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let previousScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDelta = currentScrollY - previousScrollY;

      if (currentScrollY < 72) {
        setHiddenChromePathname(null);
      } else if (scrollDelta > 4) {
        setHiddenChromePathname(pathname);
      } else if (scrollDelta < -4) {
        setHiddenChromePathname(null);
      }
      previousScrollY = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const onAvatarUpdated = (event: Event) => {
      setAvatarUrl((event as CustomEvent<string | null>).detail);
    };

    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (active) {
          setAvatarUrl(data.user?.avatarUrl ?? null);
          setSignedIn(Boolean(data.user));
          setUserId(data.user?.id ?? null);
          if (!data.user?.id) {
            setUnreadNotifications(0);
            setUnreadMessages(0);
          }
        }
      })
      .catch(() => {
        if (active) {
          setAvatarUrl(null);
          setSignedIn(false);
          setUserId(null);
          setUnreadNotifications(0);
          setUnreadMessages(0);
        }
      });

    window.addEventListener("profile-avatar-updated", onAvatarUpdated);
    return () => {
      active = false;
      window.removeEventListener("profile-avatar-updated", onAvatarUpdated);
    };
  }, [pathname]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    const refreshUnread = async () => {
      try {
        const response = await fetch("/api/notifications?summary=1");
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Unable to refresh unread activity.");
        if (active) {
          setUnreadNotifications(data.unreadNotifications ?? 0);
          setUnreadMessages(data.unreadMessages ?? 0);
        }
      } catch (error) {
        console.error("Unable to refresh unread activity.", error);
      }
    };
    const handleUnreadUpdated = () => {
      if (unreadRefreshTimerRef.current) clearTimeout(unreadRefreshTimerRef.current);
      unreadRefreshTimerRef.current = setTimeout(() => { void refreshUnread(); }, 160);
    };
    const supabase = createClient();
    const channel = supabase
      .channel(`app-unread-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      }, handleUnreadUpdated)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      }, handleUnreadUpdated)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        if (payload.new.sender_id !== userId) handleUnreadUpdated();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversation_reads",
        filter: `user_id=eq.${userId}`,
      }, handleUnreadUpdated)
      .subscribe((status, subscriptionError) => {
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && active) {
          console.error("Unread activity Realtime subscription failed.", subscriptionError);
        }
      });

    void refreshUnread();
    window.addEventListener("buildup-unread-updated", handleUnreadUpdated);
    return () => {
      active = false;
      if (unreadRefreshTimerRef.current) clearTimeout(unreadRefreshTimerRef.current);
      window.removeEventListener("buildup-unread-updated", handleUnreadUpdated);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to sign out.");
      router.push("/feed");
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Unable to sign out.");
      setSigningOut(false);
    }
  }

  return (
    <div className={`app-shell min-h-screen bg-[var(--background)] text-[var(--foreground)] ${hiddenChromePathname === pathname ? "chrome-hidden" : ""}`}>
      <header className="app-header sticky top-0 z-40">
        <div className="relative mx-auto flex h-[72px] max-w-[420px] items-center justify-center border-b border-white/[0.07] px-4 md:max-w-[598px]">
          <Link
            href="/profile"
            aria-label="Your profile"
            title="Your profile"
            className="absolute left-5"
          >
            <ProfileAvatar src={avatarUrl} alt="" className="h-[30px] w-[30px]" iconSize={17} />
          </Link>
          <Link href="/feed" aria-label="Buildup" className="flex h-7 w-[96px] items-center justify-center">
            <svg viewBox="0 0 140 36" role="img" aria-label="Buildup" className="h-full w-full overflow-visible">
              <text
                x="70"
                y="28"
                textAnchor="middle"
                className="font-brand fill-white text-[30px] font-bold"
              >
                Buildup
              </text>
            </svg>
          </Link>
          {pathname === "/profile" && signedIn && (
            <div className="absolute right-5">
              <button
                type="button"
                aria-label="Profile settings"
                title="Profile settings"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                onClick={() => {
                  setSettingsOpen((open) => !open);
                  setSignOutError("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-white"
              >
                <Settings size={19} />
              </button>
              {settingsOpen && (
                <div role="menu" className="absolute right-0 top-11 z-50 min-w-44 overflow-hidden rounded-md border hairline bg-[var(--surface)] p-1 shadow-xl">
                  <Link
                    href="/settings/blocked"
                    role="menuitem"
                    onClick={() => setSettingsOpen(false)}
                    className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm text-white hover:bg-white/[0.06]"
                  >
                    <Ban size={16} />
                    Blocked users
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={signingOut}
                    onClick={() => void signOut()}
                    className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm text-white hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                  {signOutError && <p role="alert" className="px-3 py-2 text-xs text-rose-300">{signOutError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[420px] px-0 pb-28 sm:pb-20 md:max-w-[598px]">
        <div className="sr-only">{title}</div>
        {children}
      </main>
      <nav aria-label="Primary" className="primary-nav mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-white/[0.08] bg-[#0d0f11]">
        {navItems.map(({ href, label, icon: Icon }) => {
          const unread = href === "/messages" ? unreadMessages : href === "/notifications" ? unreadNotifications : 0;
          return (
            <Link
              key={href + label}
              href={href}
              aria-label={unread > 0 ? `${label}, ${unread} unread` : label}
              className={`mobile-nav-link ${pathname === href ? "mobile-nav-active" : ""}`}
            >
              <span className="relative inline-flex">
                <Icon size={22} strokeWidth={1.8} />
                {unread > 0 && (
                  <span aria-hidden="true" className={`absolute -right-1.5 -top-1.5 flex min-h-2 min-w-2 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white ring-2 ring-[#0d0f11] ${href === "/notifications" ? "px-1" : ""}`}>
                    {href === "/notifications" && unread <= 9 ? unread : ""}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
