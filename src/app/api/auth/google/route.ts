import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth-url";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const appOrigin = getAppOrigin(request);
  const callbackUrl = new URL("/auth/callback?next=/feed", appOrigin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    const destination = new URL("/auth/auth-error?provider=google", appOrigin);
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(data.url);
}