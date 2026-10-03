import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeTerms(terms: string[]) {
  const seen = new Set<string>();
  return terms.map((term) => term.trim()).filter((term) => {
    const normalized = term.normalize("NFKC").toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function matchingTerms(left: string[], right: string[]) {
  const rightTerms = new Set(right.map((term) => term.normalize("NFKC").toLowerCase()));
  return left.filter((term) => rightTerms.has(term.normalize("NFKC").toLowerCase()));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    return NextResponse.json({ message: "Unable to verify your session." }, { status: 500 });
  }
  if (!user) return NextResponse.json({ message: "Sign in to get creator recommendations." }, { status: 401 });

  const { data: ownProfile, error: profileError } = await supabase
    .from("profiles")
    .select("skills,interests")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ message: "Unable to load your interests." }, { status: 500 });
  if (!ownProfile) return NextResponse.json({ message: "Your profile could not be found." }, { status: 404 });

  const skills = normalizeTerms(ownProfile.skills ?? []);
  const interests = normalizeTerms(ownProfile.interests ?? []);
  if (skills.length === 0 && interests.length === 0) {
    return NextResponse.json({ recommendations: [], needsProfile: true });
  }

  const [creatorsResult, followsResult, blocksResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,handle,role,bio,avatar_url,is_verified,skills,interests,created_at")
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
    supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id),
  ]);

  if (creatorsResult.error || followsResult.error || blocksResult.error) {
    return NextResponse.json({ message: "Unable to find creators for you right now." }, { status: 500 });
  }

  const excludedIds = new Set([
    user.id,
    ...(followsResult.data ?? []).map((follow) => follow.following_id),
    ...(blocksResult.data ?? []).map((block) => block.blocked_id),
  ]);

  const recommendations = (creatorsResult.data ?? [])
    .filter((creator) => !excludedIds.has(creator.id))
    .flatMap((creator) => {
      const sharedInterests = matchingTerms(interests, creator.interests ?? []);
      const sharedSkills = matchingTerms(skills, creator.skills ?? []);
      const skillsYouWant = matchingTerms(interests, creator.skills ?? []);
      const interestsInYourSkills = matchingTerms(skills, creator.interests ?? []);
      const score = sharedInterests.length * 4
        + sharedSkills.length * 3
        + skillsYouWant.length * 2
        + interestsInYourSkills.length;

      if (score === 0) return [];

      const reasons = [
        ...(sharedInterests.length ? [`Shared interests: ${sharedInterests.join(", ")}`] : []),
        ...(sharedSkills.length ? [`Shared skills: ${sharedSkills.join(", ")}`] : []),
        ...(skillsYouWant.length ? [`Skills you’re looking for: ${skillsYouWant.join(", ")}`] : []),
        ...(interestsInYourSkills.length ? [`Interested in your skills: ${interestsInYourSkills.join(", ")}`] : []),
      ];

      return [{
        id: creator.id,
        name: creator.display_name,
        handle: creator.handle,
        role: creator.role,
        bio: creator.bio,
        avatarUrl: creator.avatar_url,
        verified: creator.is_verified,
        reasons,
        score,
        createdAt: creator.created_at,
      }];
    })
    .sort((first, second) => second.score - first.score || second.createdAt.localeCompare(first.createdAt))
    .slice(0, 12)
    .map((recommendation) => ({
      id: recommendation.id,
      name: recommendation.name,
      handle: recommendation.handle,
      role: recommendation.role,
      bio: recommendation.bio,
      avatarUrl: recommendation.avatarUrl,
      verified: recommendation.verified,
      reasons: recommendation.reasons,
    }));

  return NextResponse.json({ recommendations, needsProfile: false });
}
