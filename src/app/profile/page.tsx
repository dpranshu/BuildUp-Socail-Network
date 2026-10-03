"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PostCard } from "@/components/post-card";
import { SharePostButton } from "@/components/share-post-button";
import { usePostCountsRealtime } from "@/hooks/use-post-counts-realtime";
import type { Comment, Post, Profile, Project } from "@/lib/types";
import { BadgeCheck, Cake, Camera, ExternalLink, Heart, LoaderCircle, MapPin, MessageCircle, MoreHorizontal, Pencil, Plus, Repeat2, Ruler, Trash2, X } from "lucide-react";

type ProfileTab = "posts" | "overview" | "projects";
type ConnectionsType = "followers" | "following";
type ConnectionPerson = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isFollowing: boolean;
  isCurrentUser: boolean;
};
type ConnectionsCursor = { createdAt: string; id: string };
const pronounChoices = ["he/him", "she/her", "they/them", "any pronouns", "prefer not to say"];

export default function ProfilePage({ handle }: { handle?: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadedHandle, setLoadedHandle] = useState<string | undefined>();
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [connectionsType, setConnectionsType] = useState<ConnectionsType | null>(null);
  const [connections, setConnections] = useState<ConnectionPerson[]>([]);
  const [connectionsCursor, setConnectionsCursor] = useState<ConnectionsCursor | null>(null);
  const [hasMoreConnections, setHasMoreConnections] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [updatingFollowId, setUpdatingFollowId] = useState<string | null>(null);
  const [updatingProfileFollow, setUpdatingProfileFollow] = useState(false);
  const profileFollowInFlight = useRef(false);
  const [connectionsMessage, setConnectionsMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [pronounChoice, setPronounChoice] = useState("he/him");
  const [customPronouns, setCustomPronouns] = useState("");
  const [message, setMessage] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [repostComposerPost, setRepostComposerPost] = useState<string | null>(null);
  const [repostDraft, setRepostDraft] = useState("");
  const doubleTapLikePendingRef = useRef(new Set<string>());
  const openCommentsRef = useRef(openComments);
  const profileRef = useRef(profile);

  useEffect(() => {
    if (!connectionsType || !profile?.id) return;
    let active = true;
    const params = new URLSearchParams({ type: connectionsType });

    fetch(`/api/profiles/${encodeURIComponent(profile.id)}/connections?${params}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Unable to load connections.");
        if (active) {
          setConnections(data.people ?? []);
          setConnectionsCursor(data.nextCursor ?? null);
          setHasMoreConnections(Boolean(data.hasMore));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setConnectionsMessage(error instanceof Error ? error.message : "Unable to load connections.");
        }
      })
      .finally(() => {
        if (active) setLoadingConnections(false);
      });

    return () => {
      active = false;
    };
  }, [connectionsType, profile?.id]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const query = new URLSearchParams({ section: "posts" });
        if (handle) query.set("handle", handle);
        const detailsQuery = new URLSearchParams({ section: "details" });
        if (handle) detailsQuery.set("handle", handle);
        const detailsRequest = fetch(`/api/profile?${detailsQuery}`)
          .then(async (detailsResponse) => {
            const detailsData = await detailsResponse.json();
            if (!detailsResponse.ok) throw new Error(detailsData.message ?? "Could not load profile details.");
            return { data: detailsData, error: null };
          })
          .catch((error: unknown) => {
            return {
              data: null,
              error: error instanceof Error ? error.message : "Could not load profile details.",
            };
          });
        const response = await fetch(`/api/profile?${query}`);
        if (response.status === 401) {
          if (active) setSignedOut(true);
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Could not load profile.");
        if (!active) return;

        setMessage("");
        setDetailsLoaded(false);
        setSignedOut(false);
        setProfile(data.profile ?? null);
        setLoadedHandle(handle);
        if (data.profile) {
          const savedPronouns = String(data.profile.pronouns ?? "").trim();
          const matchingChoice = pronounChoices.find((choice) => choice === savedPronouns.toLowerCase());
          setPronounChoice(matchingChoice ?? (savedPronouns ? "other" : "he/him"));
          setCustomPronouns(matchingChoice ? "" : savedPronouns);
        }

        const detailsResult = await detailsRequest;
        if (active && detailsResult.data) {
          setProfile((current) => current ? {
            ...current,
            ...detailsResult.data.details,
          } : current);
          setDetailsLoaded(true);
        } else if (active && detailsResult.error) {
          setMessage(detailsResult.error);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load profile.");
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [handle]);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId || !profile?.posts.some((post) => post.id === postId)) return;
    document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [profile?.posts]);

  const isOwnProfile = Boolean(profile?.isOwnProfile);

  useEffect(() => {
    openCommentsRef.current = openComments;
    profileRef.current = profile;
  }, [openComments, profile]);

  async function refreshPostComments(postId: string) {
    const response = await fetch(`/api/posts/${postId}/comments`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Unable to load comments.");
    setProfile((current) => current ? {
      ...current,
      posts: current.posts.map((post) => post.id === postId
        ? { ...post, commentsPreview: data.comments as Comment[] }
        : post),
    } : current);
  }

  usePostCountsRealtime(profile?.posts.map((post) => post.id) ?? [], (postId, counts) => {
    const previousComments = profileRef.current?.posts.find((post) => post.id === postId)?.comments;
    setProfile((current) => current ? {
      ...current,
      posts: current.posts.map((post) => post.id === postId
        ? { ...post, ...counts }
        : post),
    } : current);
    if (previousComments !== counts.comments && openCommentsRef.current === postId) {
      void refreshPostComments(postId).catch((error: unknown) => {
        console.error("Unable to refresh comments after a realtime update.", error);
        setMessage("New activity arrived, but comments could not be refreshed.");
      });
    }
  });

  function openConnections(type: ConnectionsType) {
    setConnectionsType(type);
    setConnections([]);
    setConnectionsCursor(null);
    setHasMoreConnections(false);
    setConnectionsMessage("");
    setLoadingConnections(true);
  }

  async function loadMoreConnections() {
    if (!profile || !connectionsType || !connectionsCursor || loadingConnections) return;
    setLoadingConnections(true);
    setConnectionsMessage("");
    const params = new URLSearchParams({
      type: connectionsType,
      before: connectionsCursor.createdAt,
      before_id: connectionsCursor.id,
    });
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profile.id)}/connections?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to load more connections.");
      setConnections((current) => [...current, ...(data.people ?? [])]);
      setConnectionsCursor(data.nextCursor ?? null);
      setHasMoreConnections(Boolean(data.hasMore));
    } catch (error) {
      setConnectionsMessage(error instanceof Error ? error.message : "Unable to load more connections.");
    } finally {
      setLoadingConnections(false);
    }
  }

  async function toggleConnectionFollow(person: ConnectionPerson) {
    if (updatingFollowId) return;
    const following = !person.isFollowing;
    const followingDelta = following ? 1 : -1;
    setConnectionsMessage("");
    setUpdatingFollowId(person.id);
    setConnections((current) => current.map((item) =>
      item.id === person.id ? { ...item, isFollowing: following } : item
    ));
    if (isOwnProfile) {
      setProfile((current) => current ? {
        ...current,
        stats: { ...current.stats, following: Math.max(0, current.stats.following + followingDelta) },
      } : current);
    }

    try {
      const response = await fetch("/api/follows", {
        method: following ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: person.id }),
      });
      const data = await response.json();
      if (response.status === 401) {
        setConnections((current) => current.map((item) =>
          item.id === person.id ? { ...item, isFollowing: person.isFollowing } : item
        ));
        if (isOwnProfile) {
          setProfile((current) => current ? {
            ...current,
            stats: { ...current.stats, following: Math.max(0, current.stats.following - followingDelta) },
          } : current);
        }
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to update follow.");
    } catch (error) {
      setConnections((current) => current.map((item) =>
        item.id === person.id ? { ...item, isFollowing: person.isFollowing } : item
      ));
      if (isOwnProfile) {
        setProfile((current) => current ? {
          ...current,
          stats: { ...current.stats, following: Math.max(0, current.stats.following - followingDelta) },
        } : current);
      }
      setConnectionsMessage(error instanceof Error ? error.message : "Unable to update follow.");
    } finally {
      setUpdatingFollowId(null);
    }
  }

  async function togglePostLike(post: Post) {
    if (!profile) return;
    setMessage("");
    const liked = !post.likedByMe;
    setProfile((current) => current ? {
      ...current,
      posts: current.posts.map((item) => item.id === post.id
        ? { ...item, likedByMe: liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
        : item),
    } : current);
    try {
      const response = await fetch(`/api/posts/${post.id}/like`, { method: liked ? "POST" : "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to update like.");
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.map((item) => item.id === post.id ? { ...item, likes: data.likes } : item),
      } : current);
    } catch (error) {
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.map((item) => item.id === post.id
          ? { ...item, likedByMe: post.likedByMe, likes: post.likes }
          : item),
      } : current);
      setMessage(error instanceof Error ? error.message : "Could not update like. Try again.");
    }
  }

  function likePostFromDoubleTap(post: Post) {
    if (post.likedByMe || doubleTapLikePendingRef.current.has(post.id)) return;
    doubleTapLikePendingRef.current.add(post.id);
    void togglePostLike(post).finally(() => doubleTapLikePendingRef.current.delete(post.id));
  }

  async function deleteProfilePost(post: Post) {
    if (!isOwnProfile || !post.isMine || !window.confirm("Hide this post from the app? Its database record will be kept.")) return;
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to hide this post.");
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.filter((item) => item.id !== post.id),
      } : current);
      setMenuPost(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to hide this post. Please try again.");
    }
  }

  async function moderateProfilePost(post: Post, action: "report" | "block" | "not_interested") {
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${post.id}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to apply this action.");

      if (action === "block") {
        setProfile((current) => current ? {
          ...current,
          posts: current.posts.filter((item) => item.authorId !== post.authorId),
        } : current);
        setMessage(`Blocked ${post.author}. Their posts won't appear in your feed.`);
      } else if (action === "not_interested") {
        setProfile((current) => current ? {
          ...current,
          posts: current.posts.filter((item) => item.id !== post.id),
        } : current);
        setMessage("We’ll show you fewer posts like this.");
      } else {
        setMessage("Report sent for review.");
      }
      setMenuPost(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to apply this action.");
    }
  }

  async function togglePostComments(postId: string) {
    if (openComments === postId) {
      setOpenComments(null);
      return;
    }
    setOpenComments(postId);
    setCommentDraft("");
    try {
      await refreshPostComments(postId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load comments.");
    }
  }

  async function submitPostComment(postId: string) {
    const body = commentDraft.trim();
    if (!body) return;
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Could not add comment.");
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.map((post) => post.id === postId
          ? {
              ...post,
              comments: typeof data.comments === "number" ? data.comments : post.comments + 1,
              commentsPreview: [...post.commentsPreview, data.comment],
            }
          : post),
      } : current);
      setCommentDraft("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  async function deletePostComment(postId: string, comment: Comment) {
    if (!comment.isMine || deletingCommentId) return;
    setDeletingCommentId(comment.id);
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${postId}/comments/${comment.id}`, { method: "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to delete this comment.");
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.map((post) => post.id === postId
          ? {
              ...post,
              comments: typeof data.comments === "number" ? data.comments : Math.max(0, post.comments - 1),
              commentsPreview: post.commentsPreview.filter((item) => item.id !== comment.id),
            }
          : post),
      } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete this comment.");
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function togglePostRepost(post: Post) {
    if (!profile) return;
    if (!post.repostedByMe) {
      setRepostComposerPost(post.id);
      setRepostDraft("");
      return;
    }
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${post.id}/repost`, { method: "DELETE" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to update repost.");
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.flatMap((item) => {
          if (item.id !== post.id) return [item];
          if (item.repostInfo && isOwnProfile) return [];
          return [{ ...item, repostedByMe: false, reposts: data.reposts }];
        }),
      } : current);
      setMenuPost(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update repost. Try again.");
    }
  }

  async function submitPostRepost(post: Post) {
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${post.id}/repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughts: repostDraft }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to repost.");
      setProfile((current) => current ? {
        ...current,
        posts: current.posts.map((item) => item.id === post.id
          ? { ...item, repostedByMe: true, reposts: data.reposts }
          : item),
      } : current);
      setRepostComposerPost(null);
      setRepostDraft("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update repost. Try again.");
    }
  }

  async function toggleFollow() {
    if (!profile || profileFollowInFlight.current) return;
    if (!profile.isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!detailsLoaded) return;
    profileFollowInFlight.current = true;
    setUpdatingProfileFollow(true);
    const following = !profile.isFollowing;
    const followerDelta = following ? 1 : -1;
    setMessage("");
    setProfile((current) => current ? {
      ...current,
      isFollowing: following,
      stats: { ...current.stats, followers: Math.max(0, current.stats.followers + followerDelta) },
    } : current);
    try {
      const response = await fetch("/api/follows", {
        method: following ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const data = await response.json();
      if (response.status === 401) {
        setProfile((current) => current ? {
          ...current,
          isFollowing: !following,
          stats: { ...current.stats, followers: Math.max(0, current.stats.followers - followerDelta) },
        } : current);
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to update follow.");
      if (data.following !== following) throw new Error("The follow change was not confirmed. Please try again.");
    } catch (error) {
      setProfile((current) => current ? {
        ...current,
        isFollowing: !following,
        stats: { ...current.stats, followers: Math.max(0, current.stats.followers - followerDelta) },
      } : current);
      setMessage(error instanceof Error ? error.message : "Could not update follow. Try again.");
    } finally {
      profileFollowInFlight.current = false;
      setUpdatingProfileFollow(false);
    }
  }

  async function uploadAvatar(file: File) {
    setBusy(true);
    setMessage("");
    const uploadData = new FormData();
    uploadData.append("file", file);
    try {
      const response = await fetch("/api/profile/avatar", { method: "POST", body: uploadData });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Unable to upload profile photo.");
      setProfile((current) => current ? { ...current, avatarUrl: data.avatarUrl } : current);
      window.dispatchEvent(new CustomEvent("profile-avatar-updated", { detail: data.avatarUrl }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload profile photo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    try {
      const payload = {
        display_name: String(formData.get("display_name") ?? ""),
        handle: String(formData.get("handle") ?? "").trim().replace(/^@+/, "").toLowerCase(),
        pronouns: String(formData.get("pronoun_choice") ?? "he/him") === "other"
          ? String(formData.get("custom_pronouns") ?? "").trim()
          : String(formData.get("pronoun_choice") ?? "he/him"),
        role: String(formData.get("role") ?? ""),
        bio: String(formData.get("bio") ?? ""),
        backstory: String(formData.get("backstory") ?? ""),
        location: String(formData.get("location") ?? ""),
        age: Number(formData.get("age")) || null,
        height: String(formData.get("height") ?? ""),
        avatar_url: String(formData.get("avatar_url") ?? "") || null,
        skills: String(formData.get("skills") ?? "").split(","),
        interests: String(formData.get("interests") ?? "").split(","),
      };
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to save profile.");
      const savedHandle = data.handle ?? `@${payload.handle}`;
      setProfile({ ...profile,
        name: payload.display_name, handle: savedHandle, role: payload.role, bio: payload.bio, pronouns: payload.pronouns,
        backstory: payload.backstory, location: payload.location, age: payload.age,
        height: payload.height, skills: payload.skills.map((value) => value.trim()).filter(Boolean),
        avatarUrl: payload.avatar_url,
        interests: payload.interests.map((value) => value.trim()).filter(Boolean),
        posts: profile.posts.map((post) => ({ ...post, handle: savedHandle })),
      });
      window.dispatchEvent(new CustomEvent("profile-avatar-updated", { detail: payload.avatar_url }));
      setEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function addProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          description: formData.get("description"),
          link: formData.get("link"),
          badge: formData.get("badge"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to save project.");
      setProfile((current) => current ? {
        ...current,
        projects: [data.project as Project, ...current.projects],
        stats: { ...current.stats, projects: current.stats.projects + 1 },
      } : current);
      setAddingProject(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save project.");
    } finally {
      setBusy(false);
    }
  }

  if (signedOut) {
    return (
      <AppShell title="Profile">
        <div className="px-6 py-16 text-center">
          <Link
            href="/login"
            aria-label="Sign in to upload a profile photo"
            title="Sign in to upload a profile photo"
            className="group relative mx-auto mb-5 block h-20 w-20"
            onPointerEnter={() => setAvatarHovered(true)}
            onPointerLeave={() => setAvatarHovered(false)}
          >
            <ProfileAvatar src={null} alt="" className="h-20 w-20" iconSize={42} />
            <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white transition-opacity ${avatarHovered ? "opacity-100" : "opacity-0"}`}>
              <Camera size={23} />
            </span>
            <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--blue)] text-white sm:hidden">
              <Camera size={13} />
            </span>
          </Link>
          <p className="font-display text-lg">Your creator profile is waiting.</p>
          <Link href="/login" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white">Sign in</Link>
        </div>
      </AppShell>
    );
  }

  if (!profile || loadedHandle !== handle) {
    return <AppShell title="Profile"><div className="px-5 py-12 text-sm text-[var(--muted)]">{message || "Loading profile…"}</div></AppShell>;
  }

  return (
    <AppShell title="Profile">
      <section className="px-5 pb-4 pt-7 sm:px-0 sm:pt-8">
        <div className="flex items-start justify-between">
          {isOwnProfile ? (
            <label
              className="group relative block h-20 w-20 cursor-pointer"
              title="Upload profile photo"
              onPointerEnter={() => setAvatarHovered(true)}
              onPointerLeave={() => setAvatarHovered(false)}
            >
              <ProfileAvatar src={profile.avatarUrl} alt={`${profile.name} profile photo`} className="h-20 w-20 text-xl shadow-lg shadow-black/30" iconSize={42} />
              <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white transition-opacity ${avatarHovered || busy ? "opacity-100" : "opacity-0"} group-focus-within:opacity-100`}>
                {busy ? <LoaderCircle size={23} className="animate-spin" /> : <Camera size={23} />}
              </span>
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--blue)] text-white sm:hidden">
                {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Camera size={13} />}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Upload profile photo"
                disabled={busy}
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void uploadAvatar(file);
                }}
              />
            </label>
          ) : (
            <ProfileAvatar src={profile.avatarUrl} alt={`${profile.name} profile photo`} className="h-20 w-20 text-xl shadow-lg shadow-black/30" iconSize={42} />
          )}
          {isOwnProfile ? (
            <button type="button" aria-label="Edit profile" title="Edit profile" onClick={() => { setEditing((value) => !value); setMessage(""); }} className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl border hairline bg-white/[0.025] text-[#c8c1b9] hover:bg-white/[0.06]">{editing ? <X size={17} /> : <Pencil size={16} />}</button>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <Link href={`/messages?with=${encodeURIComponent(profile.id)}`} aria-label={`Message ${profile.name}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border hairline bg-white/[0.04] px-3 text-sm font-semibold text-white hover:bg-white/[0.08]">
                <MessageCircle size={16} />
                Message
              </Link>
              <button type="button" onClick={() => void toggleFollow()} disabled={updatingProfileFollow || !detailsLoaded} aria-busy={updatingProfileFollow} className={`inline-flex h-9 min-w-24 items-center justify-center rounded-full px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-70 ${profile.isFollowing ? "border hairline bg-white/[0.04] text-white" : "bg-[var(--blue)] text-white"}`}>{updatingProfileFollow ? "Saving…" : !detailsLoaded ? "Loading…" : profile.isFollowing ? "Following" : "Follow"}</button>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <h1 className="font-display text-[22px] font-semibold">{profile.name}</h1>
          {profile.isVerified && <BadgeCheck size={18} className="fill-[var(--blue)] text-[var(--blue)]" />}
        </div>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">{profile.handle}{profile.pronouns && <><span className="mx-1">·</span>{profile.pronouns}</>}</p>
        <p className="mt-4 max-w-2xl text-[14px] leading-[1.65] text-[#d7d1ca] md:text-base">{profile.bio || "Share what you make and what you are learning."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
          {profile.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-[var(--blue)]" />{profile.location}</span>}
          {profile.age !== null && <span className="inline-flex items-center gap-1.5"><Cake size={14} className="text-[var(--blue)]" />{profile.age}</span>}
        </div>
        <div className="mt-5 flex items-center gap-5 text-[13px]">
          <button type="button" onClick={() => openConnections("followers")} aria-label={`View ${profile.stats.followers} followers`} className="text-left hover:opacity-80">
            <strong className="text-[15px]">{profile.stats.followers.toLocaleString()}</strong><span className="ml-1.5 text-[var(--muted)]">Followers</span>
          </button>
          <button type="button" onClick={() => openConnections("following")} aria-label={`View ${profile.stats.following} following`} className="text-left hover:opacity-80">
            <strong className="text-[15px]">{profile.stats.following.toLocaleString()}</strong><span className="ml-1.5 text-[var(--muted)]">Following</span>
          </button>
        </div>
      </section>

      {connectionsType && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-3 pb-3 pt-12 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConnectionsType(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="connections-title"
            className="flex max-h-[min(80vh,680px)] w-full max-w-[420px] flex-col overflow-hidden rounded-t-2xl border hairline bg-[var(--surface)] sm:rounded-2xl"
          >
            <header className="flex items-center justify-between border-b hairline px-5 py-4">
              <h2 id="connections-title" className="font-display text-lg font-semibold">
                {connectionsType === "followers" ? "Followers" : "Following"}
              </h2>
              <button
                type="button"
                aria-label="Close connections list"
                onClick={() => setConnectionsType(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} />
              </button>
            </header>

            {connectionsMessage && <p role="alert" className="border-b hairline px-5 py-3 text-sm text-rose-300">{connectionsMessage}</p>}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {connections.map((person) => (
                <div key={person.id} className="flex items-center justify-end gap-3 border-b border-white/[0.06] px-5">
                  <Link
                    href={`/creator/${encodeURIComponent(person.handle)}`}
                    onClick={() => setConnectionsType(null)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3"
                  >
                    <ProfileAvatar src={person.avatarUrl} alt="" className="h-11 w-11" iconSize={20} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                        {person.name}
                        {person.isVerified && <BadgeCheck size={14} className="shrink-0 fill-[var(--blue)] text-[var(--blue)]" />}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted)]">{person.handle}</span>
                    </span>
                  </Link>
                  {person.isCurrentUser ? (
                    <span className="shrink-0 rounded-full border hairline px-3 py-2 text-xs font-medium text-[var(--muted)]">
                      You
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={updatingFollowId !== null}
                      onClick={() => void toggleConnectionFollow(person)}
                      className={`min-h-9 min-w-[92px] rounded-full px-3 text-xs font-semibold disabled:opacity-50 ${
                        person.isFollowing
                          ? "border hairline bg-white/[0.04] text-white hover:bg-white/[0.08]"
                          : "bg-[var(--blue)] text-white hover:brightness-110"
                      }`}
                    >
                      {updatingFollowId === person.id ? "Saving…" : person.isFollowing ? "Unfollow" : "Follow"}
                    </button>
                  )}
                </div>
              ))}

              {!loadingConnections && !connectionsMessage && connections.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                  {connectionsType === "followers" ? "No followers yet." : "Not following anyone yet."}
                </p>
              )}

              {loadingConnections && <p role="status" className="px-5 py-4 text-center text-sm text-[var(--muted)]">Loading…</p>}

              {hasMoreConnections && !loadingConnections && (
                <button
                  type="button"
                  onClick={() => void loadMoreConnections()}
                  className="min-h-11 w-full text-sm font-semibold text-[var(--blue)] hover:bg-white/[0.03]"
                >
                  Load more
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      <div className="border-b hairline px-3 sm:px-0">
        <div role="tablist" aria-label="Profile sections" className="grid grid-cols-3 gap-2">
          {([["posts", "Posts"], ["overview", "Overview"], ["projects", "Shipped Projects"]] as const).map(([value, label]) => (
            <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className="profile-tab px-1 text-[12px] sm:text-sm">{label}</button>
          ))}
        </div>
      </div>

      {message && <p role="status" className="mx-5 mt-4 text-sm text-amber-300 sm:mx-0">{message}</p>}

      {editing && isOwnProfile && (
        <form onSubmit={saveProfile} className="mx-4 mt-5 space-y-4 border hairline bg-white/[0.025] p-4 sm:mx-0">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Edit profile</h2><button type="button" title="Close" aria-label="Close editor" onClick={() => setEditing(false)}><X size={18} /></button></div>
          <p className="text-xs leading-5 text-[var(--muted)]">Your skills and interests help Collabs suggest creators you may want to build with.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" name="display_name" defaultValue={profile.name} maxLength={80} />
            <Field label="Username" name="handle" defaultValue={profile.handle.replace(/^@+/, "")} maxLength={39} required pattern="[A-Za-z0-9._-]{2,39}" />
            <Field label="Role" name="role" defaultValue={profile.role} maxLength={80} />
            <label className="block text-xs text-[var(--muted)]">Pronouns
              <select name="pronoun_choice" value={pronounChoice} onChange={(event) => setPronounChoice(event.target.value)} className="mt-1 block min-h-10 w-full border hairline bg-[#141312] px-3 text-sm text-white outline-none focus:border-[var(--blue)]">
                <option value="he/him">He/Him</option>
                <option value="she/her">She/Her</option>
                <option value="they/them">They/Them</option>
                <option value="any pronouns">Any pronouns</option>
                <option value="prefer not to say">Prefer not to say</option>
                <option value="other">Other</option>
              </select>
            </label>
            {pronounChoice === "other" && <Field label="Your pronouns" name="custom_pronouns" defaultValue={customPronouns} maxLength={40} required />}
            <Field label="Location" name="location" defaultValue={profile.location} maxLength={120} />
            <Field label="Age" name="age" type="number" defaultValue={profile.age?.toString() ?? ""} />
            <Field label="Height" name="height" defaultValue={profile.height} maxLength={24} />
            <Field label="Skills, separated by commas" name="skills" defaultValue={profile.skills.join(", ")} />
            <Field label="Interests, separated by commas" name="interests" defaultValue={profile.interests.join(", ")} />
              <Field label="Avatar URL" name="avatar_url" type="url" defaultValue={profile.avatarUrl ?? ""} />
          </div>
          <label className="block text-xs text-[var(--muted)]">Bio<textarea name="bio" defaultValue={profile.bio} maxLength={500} rows={2} className="mt-1 block w-full resize-y border hairline bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--blue)]" /></label>
          <label className="block text-xs text-[var(--muted)]">Backstory<textarea name="backstory" defaultValue={profile.backstory} maxLength={1500} rows={3} className="mt-1 block w-full resize-y border hairline bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--blue)]" /></label>
          <button disabled={busy} className="min-h-10 rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save profile"}</button>
        </form>
      )}

      {tab === "posts" && (
        <section>
          {profile.posts.length ? profile.posts.map((post) => {
            const postCardKey = `${post.id}-${post.repostInfo ? "repost" : "post"}`;
            const canOpenPostMenu = Boolean(profile.isAuthenticated && (
              isOwnProfile ? post.isMine || post.repostInfo : true
            ));
            return (
            <PostCard
              key={postCardKey}
              id={`post-${post.id}`}
              post={post}
              onDoubleTapLike={() => likePostFromDoubleTap(post)}
              authorHref={isOwnProfile ? "/profile" : undefined}
              headerActions={canOpenPostMenu && (
                <button
                  type="button"
                  title="More post actions"
                  aria-label="More post actions"
                  aria-haspopup="menu"
                  aria-expanded={menuPost === postCardKey}
                  onClick={() => setMenuPost((current) => current === postCardKey ? null : postCardKey)}
                  className="rounded-full p-1.5 text-[var(--muted)] hover:bg-white/5"
                >
                  <MoreHorizontal size={19} />
                </button>
              )}
              toolbar={canOpenPostMenu && menuPost === postCardKey && (
                isOwnProfile && post.repostInfo ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void togglePostRepost(post)}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/[0.06]"
                  >
                    Remove repost
                  </button>
                ) : isOwnProfile && post.isMine ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void deleteProfilePost(post)}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/[0.06]"
                  >
                    Delete post
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void moderateProfilePost(post, "report")}
                      className="flex w-full items-center px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]"
                    >
                      Report post
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void moderateProfilePost(post, "block")}
                      className="flex w-full items-center px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]"
                    >
                      Block {post.author}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void moderateProfilePost(post, "not_interested")}
                      className="flex w-full items-center px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]"
                    >
                      Not interested
                    </button>
                  </>
                )
              )}
              actions={
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label={post.likedByMe ? "Unlike post" : "Like post"} aria-pressed={post.likedByMe} onClick={() => void togglePostLike(post)} className={`post-action ${post.likedByMe ? "post-action-liked" : ""}`}>
                      <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} /><span>{post.likes}</span>
                    </button>
                    <button type="button" aria-label="Show comments" aria-expanded={openComments === post.id} onClick={() => void togglePostComments(post.id)} className="post-action">
                      <MessageCircle size={18} /><span>{post.comments}</span>
                    </button>
                    <button type="button" aria-label={post.repostedByMe ? "Undo repost" : "Repost"} aria-pressed={post.repostedByMe} onClick={() => void togglePostRepost(post)} className={`post-action ${post.repostedByMe ? "text-[var(--blue)]" : ""}`}>
                      <Repeat2 size={18} /><span>{post.reposts}</span>
                    </button>
                  </div>
                  <SharePostButton post={post} />
                </div>
              }
              repostComposer={repostComposerPost === post.id && (
                <form className="mt-3 border-t hairline pt-3" onSubmit={(event) => { event.preventDefault(); void submitPostRepost(post); }}>
                  <label className="block text-xs text-[var(--muted)]" htmlFor={`profile-repost-thoughts-${post.id}`}>Add your thoughts <span>(optional)</span></label>
                  <textarea id={`profile-repost-thoughts-${post.id}`} value={repostDraft} onChange={(event) => setRepostDraft(event.target.value)} maxLength={500} rows={2} placeholder="What do you think about this?" className="mt-2 w-full resize-y bg-transparent text-sm text-white outline-none placeholder:text-[#77716b]" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setRepostComposerPost(null)} className="min-h-8 px-3 text-xs text-[var(--muted)]">Cancel</button>
                    <button type="submit" className="min-h-8 rounded-full bg-[var(--blue)] px-4 text-xs font-semibold text-white">Repost</button>
                  </div>
                </form>
              )}
              comments={openComments === post.id && (
                <div className="mt-2 border-t hairline pt-3">
                  <div className="space-y-3">
                    {post.commentsPreview.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold">{comment.author}</span>
                          <span className="ml-2 text-[var(--muted)]">{comment.body}</span>
                        </div>
                        {comment.isMine && (
                          <button
                            type="button"
                            aria-label="Delete comment"
                            title="Delete comment"
                            disabled={deletingCommentId === comment.id}
                            onClick={() => void deletePostComment(post.id, comment)}
                            className="shrink-0 text-[var(--muted)] hover:text-rose-300 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {post.commentsPreview.length === 0 && <p className="text-xs text-[var(--muted)]">No comments yet.</p>}
                  </div>
                  <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitPostComment(post.id); }}>
                    <input aria-label="Write a comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Write a reply" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#77716b]" />
                    <button disabled={!commentDraft.trim()} className="text-xs font-semibold text-[var(--blue)] disabled:opacity-40">Reply</button>
                  </form>
                </div>
              )}
            />
            );
          }) : <EmptyState title="No posts or reposts yet" detail="Updates and reposts will show up here when you share them." action={isOwnProfile ? <Link href="/create" className="text-[var(--blue)]">Write your first post</Link> : null} />}
        </section>
      )}

      {tab === "overview" && (
        !detailsLoaded
          ? <div className="px-5 py-12 text-center text-sm text-[var(--muted)]" role="status">{message || "Loading profile overview…"}</div>
          :
        <div className="space-y-7 px-5 pb-8 pt-7 sm:px-0">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Backstory</h2>
            <div className="border hairline bg-white/[0.025] px-4 py-3 text-[13px] leading-[1.75] text-[#d7d1ca]">{profile.backstory || "A little about your path, the things you are learning, and what keeps you building."}</div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Basic Information</h2>
            <div className="divide-y divide-white/[0.08] border hairline bg-white/[0.025]">
              <InfoRow icon={<Cake size={16} />} label="Age" value={profile.age === null ? "Not added" : String(profile.age)} />
              <InfoRow icon={<Ruler size={16} />} label="Height" value={profile.height || "Not added"} />
              <button onClick={() => setTab("projects")} className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-[13px] hover:bg-white/[0.03]"><span className="text-[var(--blue)]"><ExternalLink size={16} /></span><span className="flex-1 text-[#d7d1ca]">Shipped Projects</span><span className="text-[var(--blue)]">{profile.projects.length} projects ›</span></button>
              <InfoRow icon={<MapPin size={16} />} label="Location" value={profile.location || "Not added"} />
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Skills</h2>
            <div className="divide-y divide-white/[0.08] border hairline bg-white/[0.025]">
              {profile.skills.length ? profile.skills.map((skill, index) => <div key={`${skill}-${index}`} className="flex min-h-11 items-center justify-between px-3 text-[13px]"><span>{skill}</span><span className="text-[var(--muted)]">{index === 0 ? "Core skill" : ""}</span></div>) : <div className="px-3 py-4 text-[13px] text-[var(--muted)]">Add the skills you want collaborators to find.</div>}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Interest / Hobby</h2>
            <div className="divide-y divide-white/[0.08] border hairline bg-white/[0.025]">
              {profile.interests.length ? profile.interests.map((interest) => <div key={interest} className="min-h-11 px-3 py-3 text-[13px]">{interest}</div>) : <div className="px-3 py-4 text-[13px] text-[var(--muted)]">Add a few things you enjoy outside your work.</div>}
            </div>
          </section>
          {profile.projects[0] && <ProjectCard project={profile.projects[0]} />}
        </div>
      )}

      {tab === "projects" && (
        !detailsLoaded
          ? <div className="px-5 py-12 text-center text-sm text-[var(--muted)]" role="status">{message || "Loading shipped projects…"}</div>
          :
        <section className="px-5 pb-8 pt-6 sm:px-0">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Shipped Projects</h2>{isOwnProfile && <button type="button" onClick={() => { setAddingProject((value) => !value); setMessage(""); }} aria-label="Add project" title="Add project" className="flex h-8 w-8 items-center justify-center rounded-full border hairline text-[var(--blue)]"><Plus size={17} /></button>}</div>
          {addingProject && isOwnProfile && <form onSubmit={addProject} className="mb-5 space-y-3 border hairline bg-white/[0.025] p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Add a project</h3><button type="button" aria-label="Close project form" onClick={() => setAddingProject(false)}><X size={16} /></button></div>
            <Field label="Project title" name="title" required maxLength={120} />
            <label className="block text-xs text-[var(--muted)]">What is it?<textarea name="description" maxLength={1000} rows={2} className="mt-1 block w-full border hairline bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--blue)]" /></label>
            <Field label="Website (HTTPS)" name="link" type="url" placeholder="https://" />
            <Field label="Badge" name="badge" defaultValue="SHIPPED PROJECT" maxLength={80} />
            <button disabled={busy} className="min-h-10 rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save project"}</button>
          </form>}
          {profile.projects.length ? <div className="space-y-3">{profile.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <EmptyState title="No shipped projects yet" detail={isOwnProfile ? "Add shipped work and experiments to your profile." : "This creator has not added a project yet."} action={isOwnProfile ? <button onClick={() => setAddingProject(true)} className="text-[var(--blue)]">Add a project</button> : null} />}
        </section>
      )}
    </AppShell>
  );
}

function Field({ label, name, defaultValue, type = "text", maxLength, required, placeholder, pattern }: { label: string; name: string; defaultValue?: string; type?: string; maxLength?: number; required?: boolean; placeholder?: string; pattern?: string }) {
  return <label className="block text-xs text-[var(--muted)]">{label}<input name={name} type={type} defaultValue={defaultValue} maxLength={maxLength} required={required} placeholder={placeholder} pattern={pattern} className="mt-1 block min-h-10 w-full border hairline bg-black/20 px-3 text-sm text-white outline-none placeholder:text-[#77716b] focus:border-[var(--blue)]" /></label>;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex min-h-11 items-center gap-3 px-3 text-[13px]"><span className="text-[var(--blue)]">{icon}</span><span className="flex-1 text-[#d7d1ca]">{label}</span><span>{value}</span></div>;
}

function ProjectCard({ project }: { project: Project }) {
  return <article className="border hairline bg-white/[0.025] p-4">
    <div className="flex items-center justify-between gap-3 text-[10px] tracking-[0.08em]"><span className="inline-flex items-center gap-2 font-medium text-[var(--blue)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--blue)]" />{project.badge}</span><span className="shrink-0 text-[var(--muted)]">{new Date(project.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span></div>
    <h3 className="mt-2 text-[15px] font-medium leading-snug">{project.title}</h3>
    <p className="mt-1 text-[13px] leading-5 text-[#c8c1b9]">{project.description}</p>
    {project.link && <a href={project.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 border-t hairline pt-2.5 text-[13px] text-[var(--blue)]"><ExternalLink size={14} />{new URL(project.link).hostname}</a>}
  </article>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action: React.ReactNode }) {
  return <div className="border-t hairline py-12 text-center"><h3 className="text-sm font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[var(--muted)]">{detail}</p><div className="mt-4 text-sm">{action}</div></div>;
}
