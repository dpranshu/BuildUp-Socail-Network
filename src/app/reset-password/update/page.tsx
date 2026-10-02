"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to update password.");
      router.replace("/feed");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12 text-white">
      <section className="w-full max-w-md border border-white/10 bg-[var(--surface)] p-8">
        <Link href="/feed" className="font-display text-xl font-semibold">Buildup</Link>
        <h1 className="mt-8 font-display text-xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Use at least 8 characters.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-[#d7d1ca]">New password
            <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[var(--blue)]" />
          </label>
          {message && <p role="alert" className="text-sm text-amber-300">{message}</p>}
          <button disabled={busy} className="min-h-11 w-full rounded-full bg-[var(--blue)] text-sm font-semibold text-white disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>
        </form>
      </section>
    </main>
  );
}