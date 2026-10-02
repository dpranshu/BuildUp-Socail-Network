import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth-url";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ message: "Enter your account email." }, { status: 400 });

    const supabase = await createClient();
    const redirectTo = new URL("/auth/callback?next=/reset-password/update", getAppOrigin(request)).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return NextResponse.json({ message: "Unable to send a reset email right now. Try again shortly." }, { status: 502 });

    return NextResponse.json({ ok: true, message: "If an account uses that email, a password reset link is on its way." });
  } catch {
    return NextResponse.json({ message: "Invalid password reset request." }, { status: 400 });
  }
}