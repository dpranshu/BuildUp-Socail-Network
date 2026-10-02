"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to send reset email.");
      setSent(true);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12 text-white">
      <section className="w-full max-w-md border border-white/10 bg-[var(--surface)] p-8">
        <Link href="/feed" className="font-display text-xl font-semibold">Buildup</Link>
        <h1 className="mt-8 font-display text-xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">We’ll email you a secure link to choose a new password.</p>
        {!sent && <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-[#d7d1ca]">Email
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 min-h-11 w-full border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-[#77716b] focus:border-[var(--blue)]" />
          </label>
          {message && <p role="alert" className="text-sm text-amber-300">{message}</p>}
          <button disabled={busy} className="min-h-11 w-full rounded-full bg-[var(--blue)] text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send reset link"}</button>
        </form>}
        {sent && <p role="status" className="mt-5 text-sm leading-6 text-emerald-300">{message} Check your inbox and spam folder.</p>}
        <Link href="/login" className="mt-6 inline-block text-sm text-[var(--blue)]">Back to sign in</Link>
      </section>
    </main>
  );
}