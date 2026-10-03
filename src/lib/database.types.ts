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
      conversations: {
        Row: { id: string; participant_one: string; participant_two: string; created_at: string };
        Insert: { id?: string; participant_one: string; participant_two: string; created_at?: string };
        Update: { id?: string; participant_one?: string; participant_two?: string; created_at?: string };
        Relationships: [
          Relation<"conversations_participant_one_fkey", ["participant_one"], "profiles">,
          Relation<"conversations_participant_two_fkey", ["participant_two"], "profiles">
        ];
      };
      messages: {
        Row: { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
        Insert: { id?: string; conversation_id: string; sender_id: string; body: string; created_at?: string };
        Update: { id?: string; conversation_id?: string; sender_id?: string; body?: string; created_at?: string };
        Relationships: [
          Relation<"messages_conversation_id_fkey", ["conversation_id"], "conversations">,
          Relation<"messages_sender_id_fkey", ["sender_id"], "profiles">
        ];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string;
          notification_type: "like" | "follow" | "comment" | "repost" | "collab_interest" | "collab_accepted" | "collab_declined" | "message";
          source_id: string;
          post_id: string | null;
          conversation_id: string | null;
          interest_id: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id: string;
          notification_type: "like" | "follow" | "comment" | "repost" | "collab_interest" | "collab_accepted" | "collab_declined" | "message";
          source_id: string;
          post_id?: string | null;
          conversation_id?: string | null;
          interest_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string;
          notification_type?: "like" | "follow" | "comment" | "repost" | "collab_interest" | "collab_accepted" | "collab_declined" | "message";
          source_id?: string;
          post_id?: string | null;
          conversation_id?: string | null;
          interest_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          Relation<"notifications_recipient_id_fkey", ["recipient_id"], "profiles">,
          Relation<"notifications_actor_id_fkey", ["actor_id"], "profiles">,
          Relation<"notifications_post_id_fkey", ["post_id"], "posts">,
          Relation<"notifications_conversation_id_fkey", ["conversation_id"], "conversations">,
          Relation<"notifications_interest_id_fkey", ["interest_id"], "collab_interests">
        ];
      };
      conversation_reads: {
        Row: { conversation_id: string; user_id: string; last_read_at: string };
        Insert: { conversation_id: string; user_id: string; last_read_at?: string };
        Update: { conversation_id?: string; user_id?: string; last_read_at?: string };
        Relationships: [
          Relation<"conversation_reads_conversation_id_fkey", ["conversation_id"], "conversations">,
          Relation<"conversation_reads_user_id_fkey", ["user_id"], "profiles">
        ];
      };
      shipped_projects: {
        Row: { id: string; owner_id: string; title: string; description: string; link: string | null; badge: string; created_at: string };
        Insert: { id?: string; owner_id: string; title: string; description?: string; link?: string | null; badge?: string; created_at?: string };
        Update: { id?: string; owner_id?: string; title?: string; description?: string; link?: string | null; badge?: string; created_at?: string };
        Relationships: [Relation<"shipped_projects_owner_id_fkey", ["owner_id"], "profiles">];
      };
      posts: {
        Row: { id: string; author_id: string; body: string; tags: string[]; media_urls: string[]; media_type: "image" | "video" | "text"; post_kind: "post" | "opportunity"; opportunity_kind: "cofounder" | "collaborator" | "feedback" | "client" | "other" | null; opportunity_title: string | null; opportunity_role: string | null; opportunity_skills: string[]; opportunity_commitment: "flexible" | "project" | "part_time" | "full_time" | null; opportunity_work_mode: "remote" | "hybrid" | "in_person" | "flexible" | null; opportunity_location: string | null; opportunity_compensation: string | null; opportunity_status: "open" | "paused" | "filled" | null; likes_count: number; comments_count: number; reposts_count: number; created_at: string; deleted_at: string | null };
        Insert: { id?: string; author_id: string; body: string; tags?: string[]; media_urls?: string[]; media_type?: "image" | "video" | "text"; post_kind?: "post" | "opportunity"; opportunity_kind?: "cofounder" | "collaborator" | "feedback" | "client" | "other" | null; opportunity_title?: string | null; opportunity_role?: string | null; opportunity_skills?: string[]; opportunity_commitment?: "flexible" | "project" | "part_time" | "full_time" | null; opportunity_work_mode?: "remote" | "hybrid" | "in_person" | "flexible" | null; opportunity_location?: string | null; opportunity_compensation?: string | null; opportunity_status?: "open" | "paused" | "filled" | null; likes_count?: number; comments_count?: number; reposts_count?: number; created_at?: string; deleted_at?: string | null };
        Update: { id?: string; author_id?: string; body?: string; tags?: string[]; media_urls?: string[]; media_type?: "image" | "video" | "text"; post_kind?: "post" | "opportunity"; opportunity_kind?: "cofounder" | "collaborator" | "feedback" | "client" | "other" | null; opportunity_title?: string | null; opportunity_role?: string | null; opportunity_skills?: string[]; opportunity_commitment?: "flexible" | "project" | "part_time" | "full_time" | null; opportunity_work_mode?: "remote" | "hybrid" | "in_person" | "flexible" | null; opportunity_location?: string | null; opportunity_compensation?: string | null; opportunity_status?: "open" | "paused" | "filled" | null; likes_count?: number; comments_count?: number; reposts_count?: number; created_at?: string; deleted_at?: string | null };
        Relationships: [Relation<"posts_author_id_fkey", ["author_id"], "profiles">];
      };
      collab_interests: {
        Row: { id: string; post_id: string; applicant_id: string; introduction: string; status: "pending" | "accepted" | "declined"; created_at: string; updated_at: string };
        Insert: { id?: string; post_id: string; applicant_id: string; introduction: string; status?: "pending" | "accepted" | "declined"; created_at?: string; updated_at?: string };
        Update: { id?: string; post_id?: string; applicant_id?: string; introduction?: string; status?: "pending" | "accepted" | "declined"; created_at?: string; updated_at?: string };
        Relationships: [
          Relation<"collab_interests_post_id_fkey", ["post_id"], "posts">,
          Relation<"collab_interests_applicant_id_fkey", ["applicant_id"], "profiles">
        ];
      };
      post_reports: {
        Row: { id: string; post_id: string; reporter_id: string; reason: string; details: string | null; created_at: string };
        Insert: { id?: string; post_id: string; reporter_id: string; reason?: string; details?: string | null; created_at?: string };
        Update: { id?: string; post_id?: string; reporter_id?: string; reason?: string; details?: string | null; created_at?: string };
        Relationships: [Relation<"post_reports_post_id_fkey", ["post_id"], "posts">, Relation<"post_reports_reporter_id_fkey", ["reporter_id"], "profiles">];
      };
      hidden_posts: {
        Row: { user_id: string; post_id: string; created_at: string };
        Insert: { user_id: string; post_id: string; created_at?: string };
        Update: { user_id?: string; post_id?: string; created_at?: string };
        Relationships: [Relation<"hidden_posts_user_id_fkey", ["user_id"], "profiles">, Relation<"hidden_posts_post_id_fkey", ["post_id"], "posts">];
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
        Row: { id: string; post_id: string; user_id: string; thoughts: string; created_at: string };
        Insert: { id?: string; post_id: string; user_id: string; thoughts?: string; created_at?: string };
        Update: { id?: string; post_id?: string; user_id?: string; thoughts?: string; created_at?: string };
        Relationships: [Relation<"reposts_post_id_fkey", ["post_id"], "posts">, Relation<"reposts_user_id_fkey", ["user_id"], "profiles">];
      };
      follows: {
        Row: { id: string; follower_id: string; following_id: string; created_at: string };
        Insert: { id?: string; follower_id: string; following_id: string; created_at?: string };
        Update: { id?: string; follower_id?: string; following_id?: string; created_at?: string };
        Relationships: [Relation<"follows_follower_id_fkey", ["follower_id"], "profiles">, Relation<"follows_following_id_fkey", ["following_id"], "profiles">];
      };
      user_blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: { blocker_id?: string; blocked_id?: string; created_at?: string };
        Relationships: [Relation<"user_blocks_blocker_id_fkey", ["blocker_id"], "profiles">, Relation<"user_blocks_blocked_id_fkey", ["blocked_id"], "profiles">];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};