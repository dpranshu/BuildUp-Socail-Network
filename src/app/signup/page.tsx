"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "Unable to create account.");
        return;
      }

      if (result.needsEmailConfirmation) {
        setMessage("If this address can create an account, Supabase sent a confirmation email. Check your inbox and spam folder. Already registered? Sign in or reset your password.");
        return;
      }

      router.push("/feed");
      router.refresh();
    } catch {
      setMessage("Unable to reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12 text-white">
      <div className="w-full max-w-md border border-white/10 bg-[var(--surface)] p-8">
        <div className="mb-7 text-center">
          <div className="text-2xl font-black tracking-tight">
            Buildup
          </div>
          <p className="mt-2 text-sm text-slate-400">Create your creator account</p>
        </div>

        <a href="/api/auth/google" className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white text-sm font-semibold text-[#24211f] transition hover:bg-[#eeeae5]">
          <span aria-hidden="true" className="font-bold text-base text-[#4285F4]">G</span>
          Sign up with Google
        </a>
        <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-white/10" /><span>or use email</span><span className="h-px flex-1 bg-white/10" /></div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Full name</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="Create a strong password"
            />
          </div>

          {message && <p role="status" className="text-sm text-amber-300">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[var(--blue)] px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--blue)]">
            Sign in
          </Link>
        </div>
        <div className="mt-3 text-center text-sm">
          <Link href="/reset-password" className="text-[var(--blue)]">Forgot your password?</Link>
        </div>
      </div>
    </main>
  );
}
