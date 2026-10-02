"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Bell, House, Plus, Search, UserRound } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";

const navItems = [
  { href: "/feed", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/create", label: "Create", icon: Plus },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const onAvatarUpdated = (event: Event) => {
      setAvatarUrl((event as CustomEvent<string | null>).detail);
    };

    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (active) setAvatarUrl(data.user?.avatarUrl ?? null);
      })
      .catch(() => {
        if (active) setAvatarUrl(null);
      });

    window.addEventListener("profile-avatar-updated", onAvatarUpdated);
    return () => {
      active = false;
      window.removeEventListener("profile-avatar-updated", onAvatarUpdated);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="app-header sticky top-0 z-40 border-b border-white/[0.07]">
        <div className="relative mx-auto flex h-[72px] max-w-[640px] items-center justify-center px-4">
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
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[640px] px-0 pb-28 sm:pb-20">
        <div className="sr-only">{title}</div>
        {children}
      </main>
      <nav aria-label="Primary" className="mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.08] bg-[#0d0f11]">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href + label}
            href={href}
            aria-label={label}
            className={`mobile-nav-link ${pathname === href ? "mobile-nav-active" : ""}`}
          >
            <Icon size={22} strokeWidth={1.8} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
