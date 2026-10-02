export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Relation<Name extends string, Columns extends string[], Target extends string> = {
  foreignKeyName: Name;
  columns: Columns;
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ["id"];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; handle: string; pronouns: string; bio: string; location: string; age: number | null; height: string; backstory: string; role: string; avatar_url: string | null; is_verified: boolean; followers_count: number; following_count: number; skills: string[]; interests: string[]; created_at: string };
        Insert: { id: string; display_name: string; handle: string; pronouns?: string; bio?: string; location?: string; age?: number | null; height?: string; backstory?: string; role?: string; avatar_url?: string | null; is_verified?: boolean; followers_count?: number; following_count?: number; skills?: string[]; interests?: string[]; created_at?: string };
        Update: { id?: string; display_name?: string; handle?: string; pronouns?: string; bio?: string; location?: string; age?: number | null; height?: string; backstory?: string; role?: string; avatar_url?: string | null; is_verified?: boolean; followers_count?: number; following_count?: number; skills?: string[]; interests?: string[]; created_at?: string };
        Relationships: [];
      };
      shipped_projects: {
        Row: { id: string; owner_id: string; title: string; description: string; link: string | null; badge: string; created_at: string };
        Insert: { id?: string; owner_id: string; title: string; description?: string; link?: string | null; badge?: string; created_at?: string };
        Update: { id?: string; owner_id?: string; title?: string; description?: string; link?: string | null; badge?: string; created_at?: string };
        Relationships: [Relation<"shipped_projects_owner_id_fkey", ["owner_id"], "profiles">];
      };
      posts: {
        Row: { id: string; author_id: string; body: string; tags: string[]; media_urls: string[]; media_type: "image" | "video" | "text"; likes_count: number; comments_count: number; reposts_count: number; created_at: string };
        Insert: { id?: string; author_id: string; body: string; tags?: string[]; media_urls?: string[]; media_type?: "image" | "video" | "text"; likes_count?: number; comments_count?: number; reposts_count?: number; created_at?: string };
        Update: { id?: string; author_id?: string; body?: string; tags?: string[]; media_urls?: string[]; media_type?: "image" | "video" | "text"; likes_count?: number; comments_count?: number; reposts_count?: number; created_at?: string };
        Relationships: [Relation<"posts_author_id_fkey", ["author_id"], "profiles">];
      };
      likes: {
        Row: { id: string; post_id: string; user_id: string; created_at: string };
        Insert: { id?: string; post_id: string; user_id: string; created_at?: string };
        Update: { id?: string; post_id?: string; user_id?: string; created_at?: string };
        Relationships: [Relation<"likes_post_id_fkey", ["post_id"], "posts">, Relation<"likes_user_id_fkey", ["user_id"], "profiles">];
      };
      comments: {
        Row: { id: string; post_id: string; author_id: string; body: string; created_at: string };
        Insert: { id?: string; post_id: string; author_id: string; body: string; created_at?: string };
        Update: { id?: string; post_id?: string; author_id?: string; body?: string; created_at?: string };
        Relationships: [Relation<"comments_post_id_fkey", ["post_id"], "posts">, Relation<"comments_author_id_fkey", ["author_id"], "profiles">];
      };
      reposts: {
        Row: { id: string; post_id: string; user_id: string; created_at: string };
        Insert: { id?: string; post_id: string; user_id: string; created_at?: string };
        Update: { id?: string; post_id?: string; user_id?: string; created_at?: string };
        Relationships: [Relation<"reposts_post_id_fkey", ["post_id"], "posts">, Relation<"reposts_user_id_fkey", ["user_id"], "profiles">];
      };
      follows: {
        Row: { id: string; follower_id: string; following_id: string; created_at: string };
        Insert: { id?: string; follower_id: string; following_id: string; created_at?: string };
        Update: { id?: string; follower_id?: string; following_id?: string; created_at?: string };
        Relationships: [Relation<"follows_follower_id_fkey", ["follower_id"], "profiles">, Relation<"follows_following_id_fkey", ["following_id"], "profiles">];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};