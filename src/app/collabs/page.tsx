"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { OPPORTUNITY_KINDS, getOpportunityLabel, type OpportunityKind } from "@/lib/opportunities";
import type { Post } from "@/lib/types";

type FeedCursor = { createdAt: string; id: string };

export default function CollabsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [kind, setKind] = useState<OpportunityKind | "all">("all");
  const [message, setMessage] = useState("");
  const [loadedKind, setLoadedKind] = useState<OpportunityKind | "all" | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const kindRef = useRef(kind);
  const loading = loadedKind !== kind;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ kind: "opportunity", page_size: "10" });
    if (kind !== "all") params.set("opportunity_kind", kind);

    fetch(`/api/feed?${params}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Unable to load collabs.");
        if (active) {
          setPosts(data.posts ?? []);
          setNextCursor(data.nextCursor ?? null);
          setHasMore(Boolean(data.hasMore));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Unable to load collabs.");
          setPosts([]);
        }
      })
      .finally(() => {
        if (active) setLoadedKind(kind);
      });

    return () => {
      active = false;
    };
  }, [kind]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMessage("");
    const requestedKind = kind;
    const params = new URLSearchParams({
      kind: "opportunity",
      page_size: "10",
      before: nextCursor.createdAt,
      before_id: nextCursor.id,
    });
    if (kind !== "all") params.set("opportunity_kind", kind);

    try {
      const response = await fetch(`/api/feed?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to load more collabs.");
      if (kindRef.current === requestedKind) {
        setPosts((current) => [...current, ...(data.posts ?? [])]);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (error) {
      if (kindRef.current === requestedKind) {
        setMessage(error instanceof Error ? error.message : "Unable to load more collabs.");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell title="Collabs">
      <header className="flex items-center justify-between border-b hairline px-5 py-4 sm:px-0">
        <div>
          <h1 className="font-display text-xl font-semibold">Find your people</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">Ideas, skills, and creators looking to build together.</p>
        </div>
        <Link href="/create?kind=opportunity" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 text-xs font-semibold text-white">
          <Plus size={15} />
          Post a need
        </Link>
      </header>

      <section className="space-y-2 border-b hairline px-5 py-4 sm:px-0" aria-label="Filter collabs">
        <select
          value={kind}
          onChange={(event) => {
            const nextKind = event.target.value as OpportunityKind | "all";
            kindRef.current = nextKind;
            setMessage("");
            setKind(nextKind);
          }}
          aria-label="Filter by what people need"
          className="min-h-9 w-full border hairline bg-[var(--surface)] px-3 text-xs text-white outline-none focus:border-[var(--blue)]"
        >
          <option value="all">All opportunities</option>
          {OPPORTUNITY_KINDS.map((item) => <option key={item.value} value={item.value}>{getOpportunityLabel(item.value)}</option>)}
        </select>
        <p className="text-[11px] text-[var(--muted)]">
          Looking for a specific skill or creator? Use Search in the bottom menu.
        </p>
      </section>

      {message && <p role="alert" className="px-5 py-4 text-sm text-rose-300">{message}</p>}
      {loading ? (
        <div role="status" className="flex justify-center py-16"><LoaderCircle size={21} className="animate-spin text-[var(--muted)]" /></div>
      ) : posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              headerActions={!post.isMine && (
                <Link
                  href={`/messages?with=${encodeURIComponent(post.authorId)}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-[var(--blue)]/40 px-3 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue)]/10"
                >
                  Message
                </Link>
              )}
            />
          ))}
          {hasMore && (
            <div className="px-5 py-5 text-center">
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex min-h-9 items-center gap-2 rounded-full border hairline px-4 text-xs font-semibold text-white disabled:opacity-60">
                {loadingMore && <LoaderCircle size={14} className="animate-spin" />}
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-semibold">No open calls yet</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[var(--muted)]">
            Be the first to say what you’re looking for and meet your next collaborator.
          </p>
          <Link href="/create?kind=opportunity" className="mt-4 inline-flex min-h-9 items-center rounded-full bg-[var(--blue)] px-4 text-xs font-semibold text-white">Post what you need</Link>
        </div>
      )}
    </AppShell>
  );
}
