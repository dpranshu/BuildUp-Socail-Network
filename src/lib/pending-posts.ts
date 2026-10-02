import type { Post } from "@/lib/types";

export type PendingPostStatus = "preparing" | "uploading" | "failed" | "complete";

export type PendingPost = {
  id: string;
  post: Post;
  status: PendingPostStatus;
  message?: string;
  retry: () => void;
};

let pendingPosts: PendingPost[] = [];
const emptyPendingPosts: PendingPost[] = [];
const listeners = new Set<() => void>();

export function subscribePendingPosts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingPosts() {
  return pendingPosts;
}

export function getServerPendingPosts(): PendingPost[] {
  return emptyPendingPosts;
}

function notify() {
  for (const listener of listeners) listener();
}

export function addPendingPost(post: PendingPost) {
  pendingPosts = [...pendingPosts, post];
  notify();
}

export function updatePendingPost(id: string, update: Partial<PendingPost>) {
  pendingPosts = pendingPosts.map((post) => {
    if (post.id !== id) return post;
    if (post.post.mediaUrls[0]?.startsWith("blob:") && update.post) {
      URL.revokeObjectURL(post.post.mediaUrls[0]);
    }
    return { ...post, ...update };
  });
  notify();
}

export function removePendingPost(id: string) {
  const removedPost = pendingPosts.find((post) => post.id === id);
  if (removedPost?.post.mediaUrls[0]?.startsWith("blob:")) {
    URL.revokeObjectURL(removedPost.post.mediaUrls[0]);
  }
  pendingPosts = pendingPosts.filter((post) => post.id !== id);
  notify();
}
