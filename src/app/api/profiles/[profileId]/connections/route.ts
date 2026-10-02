import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ profileId: string }> };

const pageSize = 20;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export async function GET(request: Request, { params }: Context) {
  const { profileId } = await params;
  if (!uuidPattern.test(profileId)) {
    return NextResponse.json({ message: "Choose a valid profile." }, { status: 400 });
  }

  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get("type");
  if (type !== "followers" && type !== "following") {
    return NextResponse.json({ message: "Choose followers or following." }, { status: 400 });
  }

  const cursorCreatedAt = searchParams.get("before");
  const cursorId = searchParams.get("before_id");
  if (
    (cursorCreatedAt || cursorId) &&
    (!cursorCreatedAt ||
      !timestampPattern.test(cursorCreatedAt) ||
      !Number.isFinite(new Date(cursorCreatedAt).getTime()) ||
      !cursorId ||
      !uuidPattern.test(cursorId))
  ) {
    return NextResponse.json({ message: "Invalid connections cursor." }, { status: 400 });
  }

  const supabase = await createClient();
  const relationship = type === "followers"
    ? "person:profiles!follows_follower_id_fkey(id,display_name,handle,avatar_url,is_verified)"
    : "person:profiles!follows_following_id_fkey(id,display_name,handle,avatar_url,is_verified)";

  let query = supabase
    .from("follows")
    .select(`id,created_at,${relationship}`)
    .eq(type === "followers" ? "following_id" : "follower_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  if (cursorCreatedAt && cursorId) {
    query = query.or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "Unable to load this connections list." }, { status: 500 });
  }

  const hasMore = data.length > pageSize;
  const page = data.slice(0, pageSize);
  const lastFollow = page.at(-1);
  const { data: { user } } = await supabase.auth.getUser();
  const personIds = page.flatMap((follow) => follow.person ? [follow.person.id] : []);
  const followedPeopleResult = user && personIds.length > 0
    ? await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", personIds)
    : { data: [], error: null };

  if (followedPeopleResult.error) {
    return NextResponse.json({ message: "Unable to load follow status." }, { status: 500 });
  }
  const followedPeople = new Set((followedPeopleResult.data ?? []).map((follow) => follow.following_id));

  return NextResponse.json({
    people: page.flatMap((follow) => follow.person ? [{
      id: follow.person.id,
      name: follow.person.display_name,
      handle: follow.person.handle,
      avatarUrl: follow.person.avatar_url,
      isVerified: follow.person.is_verified,
      isFollowing: followedPeople.has(follow.person.id),
      isCurrentUser: user?.id === follow.person.id,
    }] : []),
    hasMore,
    nextCursor: hasMore && lastFollow
      ? { createdAt: lastFollow.created_at, id: lastFollow.id }
      : null,
  });
}
