import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth-url";

const emailOtpTypes: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email", "phone_change"];

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/feed";
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const appOrigin = getAppOrigin(request);
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const supabase = await createClient();
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const rawType = requestUrl.searchParams.get("type");
  let error: Error | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && rawType && emailOtpTypes.includes(rawType as EmailOtpType)) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    }));
  } else {
    return NextResponse.redirect(new URL("/auth/auth-error", appOrigin));
  }

  return NextResponse.redirect(new URL(error ? "/auth/auth-error" : next, appOrigin));
}