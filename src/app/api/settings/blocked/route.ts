import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in to view blocked users." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id,created_at,blocked:profiles!user_blocks_blocked_id_fkey(display_name,handle,avatar_url)")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ message: "Unable to load blocked users." }, { status: 500 });
    }

    return NextResponse.json({
      blockedUsers: data.map((block) => ({
        id: block.blocked_id,
        name: block.blocked?.display_name ?? "Creator",
        handle: block.blocked?.handle ?? "@creator",
        avatarUrl: block.blocked?.avatar_url ?? null,
        blockedAt: block.created_at,
      })),
    });
  } catch {
    return NextResponse.json({ message: "Unable to load blocked users." }, { status: 500 });
  }
}
