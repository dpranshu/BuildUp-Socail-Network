import Link from "next/link";

type AuthErrorProps = { searchParams: Promise<{ provider?: string }> };

export default async function AuthErrorPage({ searchParams }: AuthErrorProps) {
  const { provider } = await searchParams;
  const googleSetup = provider === "google";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-white">
      <section className="w-full max-w-md border border-white/10 bg-[var(--surface)] p-7">
        <h1 className="font-display text-xl font-semibold">{googleSetup ? "Google sign-in needs setup" : "This link could not be verified"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{googleSetup
          ? "In Supabase Dashboard, enable Google under Authentication → Sign In / Providers and add your Google OAuth Client ID and Secret. In Google Cloud, add the Supabase Auth callback URL shown in that provider’s settings as an authorized redirect URI. Then add this app’s URL to Supabase Auth Redirect URLs and try again."
          : "It may have expired or already been used. Sign in if your account is confirmed, or request a fresh password reset link."}</p>
        <div className="mt-6 flex gap-4 text-sm"><Link href="/login" className="text-[var(--blue)]">Sign in</Link><Link href="/reset-password" className="text-[var(--blue)]">Reset password</Link></div>
      </section>
    </main>
  );
}