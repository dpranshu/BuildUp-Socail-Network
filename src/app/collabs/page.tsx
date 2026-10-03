"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PostCard } from "@/components/post-card";
import { OPPORTUNITY_KINDS, getOpportunityLabel, type OpportunityKind } from "@/lib/opportunities";
import type { Post } from "@/lib/types";

type FeedCursor = { createdAt: string; id: string };
type CreatorRecommendation = {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  avatarUrl: string | null;
  verified: boolean;
  reasons: string[];
};
type CollabInterest = {
  id: string;
  introduction: string;
  status: "pending" | "accepted" | "declined";
  applicant: { id: string; name: string; handle: string; role: string; avatarUrl: string | null };
};
type ManagedOpportunity = {
  id: string;
  body: string;
  kind: OpportunityKind | null;
  title: string | null;
  role: string | null;
  skills: string[];
  commitment: string | null;
  workMode: string | null;
  location: string | null;
  compensation: string | null;
  status: "open" | "paused" | "filled";
  interests: CollabInterest[];
};

export default function CollabsPage() {
  const router = useRouter();
  const [view, setView] = useState<"discover" | "mine">("discover");
  const [posts, setPosts] = useState<Post[]>([]);
  const [kind, setKind] = useState<OpportunityKind | "all">("all");
  const [message, setMessage] = useState("");
  const [loadedKind, setLoadedKind] = useState<OpportunityKind | "all" | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [recommendations, setRecommendations] = useState<CreatorRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsMessage, setRecommendationsMessage] = useState("");
  const [recommendationsRequireLogin, setRecommendationsRequireLogin] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [recommendationAttempt, setRecommendationAttempt] = useState(0);
  const [updatingFollowId, setUpdatingFollowId] = useState<string | null>(null);
  const [myOpportunities, setMyOpportunities] = useState<ManagedOpportunity[]>([]);
  const [myOpportunitiesLoading, setMyOpportunitiesLoading] = useState(false);
  const [myOpportunitiesMessage, setMyOpportunitiesMessage] = useState("");
  const [myOpportunitiesAttempt, setMyOpportunitiesAttempt] = useState(0);
  const [interestPostId, setInterestPostId] = useState<string | null>(null);
  const [interestDraft, setInterestDraft] = useState("");
  const [submittingInterestId, setSubmittingInterestId] = useState<string | null>(null);
  const [updatingResponseId, setUpdatingResponseId] = useState<string | null>(null);
  const [updatingOpportunityId, setUpdatingOpportunityId] = useState<string | null>(null);
  const kindRef = useRef(kind);
  const loading = loadedKind !== kind;

  useEffect(() => {
    let active = true;

    fetch("/api/collabs/recommendations")
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          if (active) setRecommendationsRequireLogin(true);
          return;
        }
        if (!response.ok) throw new Error(data.message ?? "Unable to load creator recommendations.");
        if (active) {
          setRecommendations(data.recommendations ?? []);
          setNeedsProfile(Boolean(data.needsProfile));
          setRecommendationsRequireLogin(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRecommendationsMessage(error instanceof Error ? error.message : "Unable to load creator recommendations.");
        }
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [recommendationAttempt]);

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

  useEffect(() => {
    if (view !== "mine") return;
    let active = true;

    fetch("/api/collabs/interests?view=mine")
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) throw new Error(data.message ?? "Unable to load your opportunities.");
        if (active) setMyOpportunities(data.opportunities ?? []);
      })
      .catch((error: unknown) => {
        if (active) setMyOpportunitiesMessage(error instanceof Error ? error.message : "Unable to load your opportunities.");
      })
      .finally(() => {
        if (active) setMyOpportunitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [view, myOpportunitiesAttempt, router]);

  async function followCreator(creator: CreatorRecommendation) {
    setUpdatingFollowId(creator.id);
    setRecommendationsMessage("");
    try {
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: creator.id }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to follow this creator.");
      setRecommendations((current) => current.filter((item) => item.id !== creator.id));
    } catch (error) {
      setRecommendationsMessage(error instanceof Error ? error.message : "Unable to follow this creator.");
    } finally {
      setUpdatingFollowId(null);
    }
  }

  function retryRecommendations() {
    setRecommendationsLoading(true);
    setRecommendationsMessage("");
    setRecommendationAttempt((attempt) => attempt + 1);
  }

  async function submitInterest(post: Post) {
    setSubmittingInterestId(post.id);
    setMessage("");
    try {
      const response = await fetch("/api/collabs/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, introduction: interestDraft }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to send your introduction.");
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, myInterestStatus: "pending" } : item));
      setInterestPostId(null);
      setInterestDraft("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send your introduction.");
    } finally {
      setSubmittingInterestId(null);
    }
  }

  async function updateInterest(interestId: string, status: "accepted" | "declined") {
    setUpdatingResponseId(interestId);
    setMyOpportunitiesMessage("");
    try {
      const response = await fetch("/api/collabs/interests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", id: interestId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to update this response.");
      setMyOpportunities((current) => current.map((opportunity) => ({
        ...opportunity,
        interests: opportunity.interests.map((interest) => interest.id === interestId ? { ...interest, status } : interest),
      })));
    } catch (error) {
      setMyOpportunitiesMessage(error instanceof Error ? error.message : "Unable to update this response.");
    } finally {
      setUpdatingResponseId(null);
    }
  }

  async function updateOpportunityStatus(postId: string, status: "open" | "paused" | "filled") {
    setUpdatingOpportunityId(postId);
    setMyOpportunitiesMessage("");
    try {
      const response = await fetch("/api/collabs/interests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", postId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to update this opportunity.");
      setMyOpportunities((current) => current.map((item) => item.id === postId ? { ...item, status } : item));
    } catch (error) {
      setMyOpportunitiesMessage(error instanceof Error ? error.message : "Unable to update this opportunity.");
    } finally {
      setUpdatingOpportunityId(null);
    }
  }

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
          Post an opportunity
        </Link>
      </header>

      <div role="tablist" aria-label="Collaboration pages" className="grid grid-cols-2 border-b hairline">
        <button type="button" role="tab" aria-selected={view === "discover"} onClick={() => setView("discover")} className={`min-h-11 border-b-2 text-sm font-semibold ${view === "discover" ? "border-[var(--blue)] text-white" : "border-transparent text-[var(--muted)]"}`}>Discover</button>
        <button type="button" role="tab" aria-selected={view === "mine"} onClick={() => { setMyOpportunitiesLoading(true); setMyOpportunitiesMessage(""); setView("mine"); }} className={`min-h-11 border-b-2 text-sm font-semibold ${view === "mine" ? "border-[var(--blue)] text-white" : "border-transparent text-[var(--muted)]"}`}>My opportunities</button>
      </div>

      {view === "discover" && <section className="border-b hairline px-5 py-5 sm:px-0" aria-labelledby="recommendations-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="recommendations-title" className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-[var(--blue)]" />
              Creators matched for you
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Based on skills and interests in your profile.</p>
          </div>
          <Link href="/profile" className="shrink-0 text-xs font-medium text-[var(--blue)] hover:underline">
            Tune matches
          </Link>
        </div>

        {recommendationsRequireLogin ? (
          <p className="text-xs text-[var(--muted)]">
            <Link href="/login" className="font-semibold text-[var(--blue)] hover:underline">Sign in</Link> to see creators matched to your interests.
          </p>
        ) : recommendationsLoading ? (
          <div role="status" className="flex justify-center py-5"><LoaderCircle size={19} className="animate-spin text-[var(--muted)]" /></div>
        ) : recommendationsMessage ? (
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="text-xs text-rose-300">{recommendationsMessage}</p>
            <button type="button" onClick={retryRecommendations} className="shrink-0 text-xs font-semibold text-[var(--blue)]">Try again</button>
          </div>
        ) : needsProfile ? (
          <div className="border hairline bg-white/[0.025] px-4 py-4">
            <p className="text-sm font-medium">Add skills or interests to get better matches.</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Creators are matched using the skills and interests you add to your profile.</p>
            <Link href="/profile" className="mt-3 inline-flex min-h-8 items-center rounded-full bg-[var(--blue)] px-3 text-xs font-semibold text-white">Edit your profile</Link>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((creator) => (
              <article key={creator.id} className="border hairline bg-white/[0.025] p-3">
                <div className="flex items-start gap-3">
                  <Link href={`/creator/${encodeURIComponent(creator.handle)}`} aria-label={`View ${creator.name}'s profile`}>
                    <ProfileAvatar src={creator.avatarUrl} alt="" className="h-11 w-11" iconSize={20} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/creator/${encodeURIComponent(creator.handle)}`} className="truncate text-sm font-semibold hover:underline">{creator.name}</Link>
                      {creator.verified && <BadgeCheck size={14} className="shrink-0 fill-[var(--blue)] text-[var(--blue)]" />}
                    </div>
                    <p className="truncate text-xs text-[var(--muted)]">{creator.handle}{creator.role ? ` · ${creator.role}` : ""}</p>
                    {creator.bio && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#d0cbc5]">{creator.bio}</p>}
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Why this creator is recommended">
                  {creator.reasons.map((reason) => (
                    <li key={reason} className="rounded-full border border-[var(--blue)]/25 bg-[var(--blue)]/[0.08] px-2.5 py-1 text-[10px] leading-4 text-[#b9d6ff]">{reason}</li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Link href={`/creator/${encodeURIComponent(creator.handle)}`} className="inline-flex min-h-8 items-center rounded-full border hairline px-3 text-xs font-semibold hover:bg-white/[0.05]">View profile</Link>
                  <Link href={`/messages?with=${encodeURIComponent(creator.id)}`} className="inline-flex min-h-8 items-center rounded-full border border-[var(--blue)]/40 px-3 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue)]/10">Message</Link>
                  <button type="button" disabled={updatingFollowId !== null} onClick={() => void followCreator(creator)} className="ml-auto min-h-8 rounded-full bg-[var(--blue)] px-3 text-xs font-semibold text-white disabled:opacity-50">
                    {updatingFollowId === creator.id ? "Following…" : "Follow"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border hairline bg-white/[0.025] px-4 py-4">
            <p className="text-sm font-medium">No close matches yet.</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Add more skills and interests to your profile, then check back as new creators join.</p>
          </div>
        )}
      </section>}

      {view === "discover" && <section className="space-y-2 border-b hairline px-5 py-4 sm:px-0" aria-label="Filter collabs">
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
      </section>}

      {view === "discover" && message && <p role="alert" className="px-5 py-4 text-sm text-rose-300">{message}</p>}
      {view === "discover" && (loading ? (
        <div role="status" className="flex justify-center py-16"><LoaderCircle size={21} className="animate-spin text-[var(--muted)]" /></div>
      ) : posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              headerActions={!post.isMine && (post.myInterestStatus === "accepted" ? (
                <Link
                  href={`/messages?with=${encodeURIComponent(post.authorId)}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-[var(--blue)]/40 px-3 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue)]/10"
                >
                  Message creator
                </Link>
              ) : post.myInterestStatus ? (
                <span className="inline-flex min-h-8 items-center rounded-full border hairline px-3 text-xs font-medium text-[var(--muted)]">
                  {post.myInterestStatus === "pending" ? "Interest sent" : "Response declined"}
                </span>
              ) : interestPostId === post.id ? (
                <form onSubmit={(event) => { event.preventDefault(); void submitInterest(post); }} className="w-56 space-y-2 rounded-md border hairline bg-[var(--surface)] p-2">
                  <label htmlFor={`collab-intro-${post.id}`} className="block text-xs font-medium">Introduce yourself</label>
                  <textarea id={`collab-intro-${post.id}`} required minLength={10} maxLength={800} value={interestDraft} onChange={(event) => setInterestDraft(event.target.value)} rows={3} placeholder="Why does this opportunity interest you?" className="w-full resize-y border hairline bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--blue)]" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setInterestPostId(null); setInterestDraft(""); }} className="min-h-7 px-2 text-xs text-[var(--muted)]">Cancel</button>
                    <button type="submit" disabled={submittingInterestId !== null} className="min-h-7 rounded-full bg-[var(--blue)] px-3 text-xs font-semibold text-white disabled:opacity-50">{submittingInterestId === post.id ? "Sending…" : "Send intro"}</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => { setInterestPostId(post.id); setInterestDraft(""); }} className="inline-flex min-h-8 items-center rounded-full border border-[var(--blue)]/40 px-3 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue)]/10">
                  I’m interested
                </button>
              ))}
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
      ))}

      {view === "mine" && (
        <section aria-label="Your collaboration opportunities">
          {myOpportunitiesMessage && (
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-0">
              <p role="alert" className="text-sm text-rose-300">{myOpportunitiesMessage}</p>
              <button type="button" onClick={() => { setMyOpportunitiesLoading(true); setMyOpportunitiesMessage(""); setMyOpportunitiesAttempt((attempt) => attempt + 1); }} className="shrink-0 text-xs font-semibold text-[var(--blue)]">Try again</button>
            </div>
          )}
          {myOpportunitiesLoading ? (
            <div role="status" className="flex justify-center py-16"><LoaderCircle size={21} className="animate-spin text-[var(--muted)]" /></div>
          ) : myOpportunities.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold">No opportunities posted yet</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[var(--muted)]">Your posts and creator introductions will be managed here.</p>
              <Link href="/create?kind=opportunity" className="mt-4 inline-flex min-h-9 items-center rounded-full bg-[var(--blue)] px-4 text-xs font-semibold text-white">Post an opportunity</Link>
            </div>
          ) : myOpportunities.map((opportunity) => (
            <article key={opportunity.id} className="border-b hairline px-5 py-5 sm:px-0">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--blue)]">{getOpportunityLabel(opportunity.kind)}</p>
                  <h2 className="mt-1 text-base font-semibold">{opportunity.title || "Collaboration opportunity"}</h2>
                  {opportunity.role && <p className="mt-1 text-xs text-[var(--muted)]">Looking for: {opportunity.role}</p>}
                </div>
                <select aria-label={`Status for ${opportunity.title || "opportunity"}`} value={opportunity.status} disabled={updatingOpportunityId === opportunity.id} onChange={(event) => {
                  const status = event.target.value;
                  if (status === "open" || status === "paused" || status === "filled") void updateOpportunityStatus(opportunity.id, status);
                }} className="min-h-9 shrink-0 border hairline bg-[var(--surface)] px-2 text-xs text-white outline-none focus:border-[var(--blue)] disabled:opacity-60">
                  <option value="open">Open</option>
                  <option value="paused">Paused</option>
                  <option value="filled">Filled</option>
                </select>
              </div>
              {opportunity.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#ded9d3]">{opportunity.body}</p>}
              <p className="mt-2 text-xs text-[var(--muted)]">{opportunity.commitment?.replace("_", "-")} · {opportunity.workMode?.replace("_", " ")}{opportunity.location ? ` · ${opportunity.location}` : ""}</p>
              {opportunity.skills.length > 0 && <p className="mt-2 text-xs text-[#d0cbc5]">Skills: {opportunity.skills.join(", ")}</p>}
              {opportunity.compensation && <p className="mt-2 text-xs text-[#d0cbc5]">Compensation: {opportunity.compensation}</p>}

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Interested creators · {opportunity.interests.length}</h3>
                {opportunity.interests.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">Introductions will appear here.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {opportunity.interests.map((interest) => (
                      <div key={interest.id} className="border hairline bg-white/[0.025] p-3">
                        <div className="flex items-center gap-3">
                          <Link href={`/creator/${encodeURIComponent(interest.applicant.handle)}`} aria-label={`View ${interest.applicant.name}'s profile`}>
                            <ProfileAvatar src={interest.applicant.avatarUrl} alt="" className="h-9 w-9" iconSize={17} />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link href={`/creator/${encodeURIComponent(interest.applicant.handle)}`} className="truncate text-sm font-semibold hover:underline">{interest.applicant.name}</Link>
                            <p className="truncate text-xs text-[var(--muted)]">{interest.applicant.handle}{interest.applicant.role ? ` · ${interest.applicant.role}` : ""}</p>
                          </div>
                          <span className="shrink-0 rounded-full border hairline px-2 py-1 text-[10px] capitalize text-[var(--muted)]">{interest.status}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-[#ded9d3]">{interest.introduction}</p>
                        {interest.status === "pending" ? (
                          <div className="mt-3 flex justify-end gap-2">
                            <button type="button" disabled={updatingResponseId !== null} onClick={() => void updateInterest(interest.id, "declined")} className="min-h-8 rounded-full border hairline px-3 text-xs text-[var(--muted)] disabled:opacity-50">{updatingResponseId === interest.id ? "Saving…" : "Pass"}</button>
                            <button type="button" disabled={updatingResponseId !== null} onClick={() => void updateInterest(interest.id, "accepted")} className="min-h-8 rounded-full bg-[var(--blue)] px-3 text-xs font-semibold text-white disabled:opacity-50">{updatingResponseId === interest.id ? "Saving…" : "Accept & connect"}</button>
                          </div>
                        ) : interest.status === "accepted" ? (
                          <Link href={`/messages?with=${encodeURIComponent(interest.applicant.id)}`} className="mt-3 inline-flex min-h-8 items-center rounded-full border border-[var(--blue)]/40 px-3 text-xs font-semibold text-[var(--blue)]">Message creator</Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
