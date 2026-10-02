import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ message: "Email or password is incorrect. If you just signed up, confirm your email first or reset your password." }, { status: 401 });
    }

    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json({ message: "Invalid sign-in request." }, { status: 400 });
  }
}