import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth-url";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || name.length > 80 || !email || !password || password.length < 8) {
      return NextResponse.json(
        { message: "Enter a name and email, and use a password with at least 8 characters." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: new URL("/auth/callback?next=/feed", getAppOrigin(request)).toString(),
      },
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { needsEmailConfirmation: !data.session, authenticated: Boolean(data.session) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: "Invalid signup request." }, { status: 400 });
  }
}
