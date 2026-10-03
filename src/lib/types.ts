import type { OpportunityKind, PostKind } from "@/lib/opportunities";

export type Post = {
  id: string;
  authorId: string;
  author: string;
  handle: string;
  authorBio: string;
  avatarUrl: string | null;
  isVerified: boolean;
  body: string;
  tags: string[];
  likes: number;
  comments: number;
  reposts: number;
  mediaUrls: string[];
  mediaType: "image" | "video" | "text";
  postKind: PostKind;
  opportunityKind: OpportunityKind | null;
  createdAt: string;
  isMine: boolean;
  likedByMe: boolean;
  repostedByMe: boolean;
  repostInfo?: {
    name: string;
    handle: string;
    thoughts: string;
  };
  commentsPreview: Comment[];
};

export type Comment = {
  id: string;
  author: string;
  handle: string;
  body: string;
  createdAt: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  link: string | null;
  badge: string;
  createdAt: string;
};

export type Profile = {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  backstory: string;
  pronouns: string;
  location: string;
  age: number | null;
  height: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  skills: string[];
  interests: string[];
  createdAt: string;
  stats: {
    followers: number;
    following: number;
    posts: number;
    projects: number;
  };
  posts: Post[];
  projects: Project[];
  isFollowing: boolean;
};