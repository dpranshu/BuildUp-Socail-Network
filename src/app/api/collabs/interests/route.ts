import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opportunitySelect = "id,body,opportunity_kind,opportunity_title,opportunity_role,opportunity_skills,opportunity_commitment,opportunity_work_mode,opportunity_location,opportunity_compensation,opportunity_status,created_at";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to manage your collaboration opportunities." }, { status: 401 });
  if (new URL(request.url).searchParams.get("view") !== "mine") {
    return NextResponse.json({ message: "Choose a valid collaboration view." }, { status: 400 });
  }

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select(opportunitySelect)
    .eq("author_id", user.id)
    .eq("post_kind", "opportunity")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (postsError) {
    console.error("Unable to load creator opportunities.", { code: postsError.code, message: postsError.message });
    return NextResponse.json({ message: "Unable to load your opportunities." }, { status: 500 });
  }

  const postIds = (posts ?? []).map((post) => post.id);
  const interestsResult = postIds.length > 0
    ? await supabase
        .from("collab_interests")
        .select("id,post_id,applicant_id,introduction,status,created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [], error: null };

  if (interestsResult.error) {
    console.error("Unable to load collaboration responses.", { code: interestsResult.error.code, message: interestsResult.error.message });
    return NextResponse.json({ message: "Unable to load responses to your opportunities." }, { status: 500 });
  }

  const applicantIds = [...new Set((interestsResult.data ?? []).map((interest) => interest.applicant_id))];
  const applicantsResult = applicantIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id,display_name,handle,role,avatar_url")
        .in("id", applicantIds)
    : { data: [], error: null };

  if (applicantsResult.error) {
    console.error("Unable to load collaboration applicants.", { code: applicantsResult.error.code, message: applicantsResult.error.message });
    return NextResponse.json({ message: "Unable to load creator profiles for responses." }, { status: 500 });
  }

  const applicants = new Map((applicantsResult.data ?? []).map((profile) => [profile.id, profile]));
  const interestsByPost = new Map<string, Array<{
    id: string;
    introduction: string;
    status: "pending" | "accepted" | "declined";
    createdAt: string;
    applicant: { id: string; name: string; handle: string; role: string; avatarUrl: string | null };
  }>>();

  for (const interest of interestsResult.data ?? []) {
    const applicant = applicants.get(interest.applicant_id);
    if (!applicant) continue;
    const responses = interestsByPost.get(interest.post_id) ?? [];
    responses.push({
      id: interest.id,
      introduction: interest.introduction,
      status: interest.status,
      createdAt: interest.created_at,
      applicant: {
        id: applicant.id,
        name: applicant.display_name,
        handle: applicant.handle,
        role: applicant.role,
        avatarUrl: applicant.avatar_url,
      },
    });
    interestsByPost.set(interest.post_id, responses);
  }

  return NextResponse.json({
    opportunities: (posts ?? []).map((post) => ({
      id: post.id,
      body: post.body,
      kind: post.opportunity_kind,
      title: post.opportunity_title,
      role: post.opportunity_role,
      skills: post.opportunity_skills,
      commitment: post.opportunity_commitment,
      workMode: post.opportunity_work_mode,
      location: post.opportunity_location,
      compensation: post.opportunity_compensation,
      status: post.opportunity_status,
      createdAt: post.created_at,
      interests: interestsByPost.get(post.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid collaboration request." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ message: "Invalid collaboration request." }, { status: 400 });
  }
  const body = input as { postId?: unknown; introduction?: unknown };

  const postId = typeof body.postId === "string" ? body.postId : "";
  const introduction = typeof body.introduction === "string" ? body.introduction.trim() : "";
  if (!uuidPattern.test(postId)) return NextResponse.json({ message: "Choose a valid opportunity." }, { status: 400 });
  if (introduction.length < 10 || introduction.length > 800) {
    return NextResponse.json({ message: "Write a short introduction between 10 and 800 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to express interest." }, { status: 401 });

  const { data: opportunity, error: opportunityError } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("post_kind", "opportunity")
    .eq("opportunity_status", "open")
    .is("deleted_at", null)
    .neq("author_id", user.id)
    .maybeSingle();

  if (opportunityError) {
    console.error("Unable to validate collaboration opportunity.", { code: opportunityError.code, message: opportunityError.message });
    return NextResponse.json({ message: "Unable to check this opportunity." }, { status: 500 });
  }
  if (!opportunity) return NextResponse.json({ message: "This opportunity is no longer open." }, { status: 409 });

  const { error } = await supabase.from("collab_interests").insert({
    post_id: postId,
    applicant_id: user.id,
    introduction,
  });
  if (error?.code === "23505") {
    return NextResponse.json({ message: "You already expressed interest in this opportunity." }, { status: 409 });
  }
  if (error) {
    console.error("Unable to save collaboration interest.", { code: error.code, message: error.message });
    return NextResponse.json({ message: "Unable to send your introduction." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
}

export async function PATCH(request: Request) {
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid collaboration update." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ message: "Invalid collaboration update." }, { status: 400 });
  }
  const body = input as { action?: unknown; id?: unknown; status?: unknown; postId?: unknown };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to manage your opportunities." }, { status: 401 });

  if (body.action === "respond") {
    const id = typeof body.id === "string" ? body.id : "";
    const status = body.status;
    if (!uuidPattern.test(id) || (status !== "accepted" && status !== "declined")) {
      return NextResponse.json({ message: "Choose a valid response." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("collab_interests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id,status,applicant_id")
      .maybeSingle();
    if (error) {
      console.error("Unable to respond to collaboration interest.", { code: error.code, message: error.message });
      return NextResponse.json({ message: "Unable to update this response." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ message: "This response has already been reviewed." }, { status: 409 });
    return NextResponse.json({ ok: true, status: data.status, applicantId: data.applicant_id });
  }

  if (body.action === "status") {
    const postId = typeof body.postId === "string" ? body.postId : "";
    const status = body.status;
    if (!uuidPattern.test(postId) || (status !== "open" && status !== "paused" && status !== "filled")) {
      return NextResponse.json({ message: "Choose a valid opportunity status." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("posts")
      .update({ opportunity_status: status })
      .eq("id", postId)
      .eq("author_id", user.id)
      .eq("post_kind", "opportunity")
      .is("deleted_at", null)
      .select("id,opportunity_status")
      .maybeSingle();
    if (error) {
      console.error("Unable to update opportunity status.", { code: error.code, message: error.message });
      return NextResponse.json({ message: "Unable to update this opportunity." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ message: "Opportunity not found or unavailable." }, { status: 404 });
    return NextResponse.json({ ok: true, status: data.opportunity_status });
  }

  return NextResponse.json({ message: "Choose a valid collaboration update." }, { status: 400 });
}
