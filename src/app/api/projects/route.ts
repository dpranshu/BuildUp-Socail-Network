import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: unknown; description?: unknown; link?: unknown; badge?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const link = typeof body.link === "string" ? body.link.trim() : "";
    const badge = typeof body.badge === "string" ? body.badge.trim() : "SHIPPED PROJECT";
    if (!title || title.length > 120 || description.length > 1000 || badge.length > 80 || (link && !/^https:\/\//i.test(link))) {
      return NextResponse.json({ message: "Check the title, description, and HTTPS URL." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in to add a project." }, { status: 401 });
    const { data, error } = await supabase.from("shipped_projects")
      .insert({ owner_id: user.id, title, description, link: link || null, badge })
      .select("id,title,description,link,badge,created_at").single();
    if (error) return NextResponse.json({ message: "Unable to save the project." }, { status: 500 });
    return NextResponse.json({ project: { ...data, createdAt: data.created_at } }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid project request." }, { status: 400 });
  }
}