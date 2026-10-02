"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BadgeCheck, Search } from "lucide-react";
import type { Post } from "@/lib/types";

type CreatorResult = {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  avatarUrl: string | null;
  verified: boolean;
  followers: number;
  isFollowing: boolean;
  isMine: boolean;
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [creators, setCreators] = useState<CreatorResult[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    setSubmittedQuery(cleanQuery);
    setMessage("");
    if (cleanQuery.length < 2) {
      setCreators([]);
      setPosts([]);
      setMessage("Type at least two characters to search.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Search failed.");
      setCreators(data.creators ?? []);
      setPosts(data.posts ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed.");
      setCreators([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow(creator: CreatorResult) {
    const following = !creator.isFollowing;
    setCreators((items) => items.map((item) => item.id === creator.id
      ? { ...item, isFollowing: following, followers: Math.max(0, item.followers + (following ? 1 : -1)) }
      : item));
    try {
      const response = await fetch("/api/follows", {
        method: following ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: creator.id }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error("Unable to update follow.");
    } catch {
      setCreators((items) => items.map((item) => item.id === creator.id
        ? { ...item, isFollowing: creator.isFollowing, followers: creator.followers }
        : item));
      setMessage("Could not update follow. Try again.");
    }
  }

  return (
    <AppShell title="Search">
      <div className="border-b hairline px-4 py-4 sm:px-0">
        <form onSubmit={search} className="flex min-h-11 items-center gap-3 border hairline bg-white/[0.035] px-3">
          <Search size={18} className="shrink-0 text-[var(--muted)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search creators and posts" placeholder="Search creators or ideas" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#817b74]" />
          <button disabled={loading} className="text-sm font-semibold text-[var(--blue)] disabled:opacity-50">{loading ? "Searching…" : "Search"}</button>
        </form>
      </div>

      {message && <p role="status" className="px-5 py-3 text-sm text-[var(--muted)]">{message}</p>}
      {submittedQuery && !loading && <div className="px-5 pb-2 pt-4 text-xs uppercase tracking-[0.08em] text-[var(--muted)] sm:px-0">Results for “{submittedQuery}”</div>}

      {creators.length > 0 && <section className="border-b hairline">
        <h2 className="px-5 pb-2 pt-4 text-sm font-semibold sm:px-0">Creators</h2>
        {creators.map((creator) => <article key={creator.id} className="flex items-center gap-3 border-t hairline px-4 py-3 sm:px-0">
          <Link href={`/creator/${encodeURIComponent(creator.handle)}`} className="profile-image flex h-11 w-11 shrink-0 items-center justify-center rounded-full border hairline text-sm font-semibold">{creator.name.slice(0, 1)}</Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold"><Link href={`/creator/${encodeURIComponent(creator.handle)}`} className="truncate">{creator.name}</Link>{creator.verified && <BadgeCheck size={14} className="fill-[var(--blue)] text-[var(--blue)]" />}</div>
            <p className="truncate text-xs text-[var(--muted)]">{creator.handle} · {creator.role}</p>
            <p className="mt-1 line-clamp-1 text-xs text-[#d0cbc5]">{creator.bio}</p>
          </div>
          {!creator.isMine && <button onClick={() => void toggleFollow(creator)} className={`min-h-8 shrink-0 rounded-full px-4 text-xs font-semibold ${creator.isFollowing ? "border hairline bg-white/[0.04]" : "bg-[var(--blue)] text-white"}`}>{creator.isFollowing ? "Following" : "Follow"}</button>}
        </article>)}
      </section>}

      {posts.length > 0 && <section>
        <h2 className="px-5 pb-2 pt-4 text-sm font-semibold sm:px-0">Posts</h2>
        {posts.map((post) => <article key={post.id} className="border-t hairline px-4 py-4 sm:px-0">
          <Link href={`/creator/${encodeURIComponent(post.handle)}`} className="text-sm font-semibold">{post.author}<span className="ml-2 text-xs font-normal text-[var(--muted)]">{post.handle}</span></Link>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#ded9d3]">{post.body}</p>
          {post.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--blue)]">{post.tags.map((tag) => <span key={`${post.id}-${tag}`}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}</div>}
          <p className="mt-3 text-xs text-[var(--muted)]">♡ {post.likes}<span className="mx-4">◯ {post.comments}</span><span>↻ {post.reposts}</span></p>
        </article>)}
      </section>}

      {submittedQuery && !loading && creators.length === 0 && posts.length === 0 && !message && <div className="px-6 py-14 text-center"><p className="text-sm font-semibold">No matches yet</p><p className="mt-2 text-xs text-[var(--muted)]">Try a creator name, handle, or a phrase from a post.</p></div>}
    </AppShell>
  );
}
