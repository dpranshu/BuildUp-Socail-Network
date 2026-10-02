"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, UserRoundX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";

type BlockedUser = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  blockedAt: string;
};

export default function BlockedUsersPage() {
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/settings/blocked")
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) throw new Error(data.message ?? "Unable to load blocked users.");
        if (active) setBlockedUsers(data.blockedUsers ?? []);
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Unable to load blocked users.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function unblockUser(blockedUser: BlockedUser) {
    setMessage("");
    setUnblockingId(blockedUser.id);
    try {
      const response = await fetch(`/api/settings/blocked/${encodeURIComponent(blockedUser.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to unblock this account.");
      setBlockedUsers((current) => current.filter((item) => item.id !== blockedUser.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to unblock this account.");
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <AppShell title="Blocked users">
      <div className="flex items-center gap-3 border-b hairline px-5 py-4">
        <Link
          href="/profile"
          aria-label="Back to your profile"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft size={19} />
        </Link>
        <div>
          <h1 className="font-display text-lg font-semibold">Blocked users</h1>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Posts from these accounts are hidden from your feed.</p>
        </div>
      </div>

      {message && <p role="alert" className="border-b hairline px-5 py-3 text-sm text-rose-300">{message}</p>}

      {loading ? (
        <div className="space-y-3 px-5 py-5" aria-label="Loading blocked users">
          <div className="h-14 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded bg-white/[0.04]" />
        </div>
      ) : !message && blockedUsers.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Ban size={28} className="mx-auto text-[var(--muted)]" aria-hidden="true" />
          <p className="mt-4 font-display text-lg font-medium">No blocked users</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Accounts you block from a post will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.07]">
          {blockedUsers.map((blockedUser) => (
            <li key={blockedUser.id} className="flex items-center gap-3 px-5 py-4">
              <ProfileAvatar src={blockedUser.avatarUrl} alt="" className="h-11 w-11" iconSize={20} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{blockedUser.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">{blockedUser.handle}</p>
              </div>
              <button
                type="button"
                disabled={unblockingId === blockedUser.id}
                onClick={() => void unblockUser(blockedUser)}
                className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-medium text-white hover:bg-white/[0.06] disabled:opacity-50"
              >
                <UserRoundX size={15} />
                {unblockingId === blockedUser.id ? "Unblocking…" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
