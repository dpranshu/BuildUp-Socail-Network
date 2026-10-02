import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) return NextResponse.json({ message: "Use a password with at least 8 characters." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: "The reset link is missing or expired. Request another one." }, { status: 401 });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Invalid password update request." }, { status: 400 });
  }
}