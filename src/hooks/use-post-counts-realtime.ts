"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type PostCounts = {
  likes: number;
  comments: number;
  reposts: number;
};

export function usePostCountsRealtime(
  postIds: readonly string[],
  onCounts: (postId: string, counts: PostCounts) => void,
) {
  const onCountsRef = useRef(onCounts);
  const postIdsKey = [...new Set(postIds.filter(Boolean))].sort().join(",");

  useEffect(() => {
    onCountsRef.current = onCounts;
  }, [onCounts]);

  useEffect(() => {
    if (!postIdsKey) return;
    const activePostIds = new Set(postIdsKey.split(","));
    const supabase = createClient();
    const channel = supabase
      .channel(`post-counts-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new;
          if (
            typeof row.id !== "string"
            || !activePostIds.has(row.id)
            || typeof row.likes_count !== "number"
            || typeof row.comments_count !== "number"
            || typeof row.reposts_count !== "number"
          ) return;
          onCountsRef.current(row.id, {
            likes: row.likes_count,
            comments: row.comments_count,
            reposts: row.reposts_count,
          });
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Post count Realtime subscription failed.", error);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [postIdsKey]);
}
