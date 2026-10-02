"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function NotificationsPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => setSignedIn(Boolean(data.user)))
      .catch(() => setSignedIn(false));
  }, []);

  return (
    <AppShell title="Notifications">
      <section className="px-5 pb-12 pt-6 sm:px-0">
        <h1 className="font-display text-xl font-semibold">Notifications</h1>
        {signedIn === null ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Loading notifications…</p>
        ) : signedIn ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border hairline bg-white/[0.04] text-[var(--muted)]">
              <Bell size={21} strokeWidth={1.7} />
            </span>
            <p className="mt-4 text-sm font-medium">You’re all caught up.</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">New activity on your posts will appear here.</p>
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-[var(--muted)]">Sign in to view your notifications.</p>
            <Link href="/login" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white">Sign in</Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}