import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return updateFollow(request, true);
}

export async function DELETE(request: Request) {
  return updateFollow(request, false);
}

async function updateFollow(request: Request, follow: boolean) {
  try {
    const body = (await request.json()) as { profileId?: unknown };
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!profileId) return NextResponse.json({ message: "Profile ID is required." }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to follow creators." }, { status: 401 });
    if (user.id === profileId) return NextResponse.json({ message: "You cannot follow yourself." }, { status: 400 });

    const result = follow
      ? await supabase.from("follows").upsert({ follower_id: user.id, following_id: profileId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true })
      : await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profileId);
    if (result.error) return NextResponse.json({ message: "Unable to update follow." }, { status: 500 });
    return NextResponse.json({ following: follow });
  } catch {
    return NextResponse.json({ message: "Invalid follow request." }, { status: 400 });
  }
}