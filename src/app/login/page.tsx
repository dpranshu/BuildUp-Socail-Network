import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/4 p-8 shadow-2xl shadow-violet-500/10">
        <div className="mb-7 text-center">
          <div className="text-2xl font-black tracking-tight">
            build<span className="text-cyan-400">in</span>public
          </div>
          <p className="mt-2 text-sm text-slate-400">Sign in to your creator profile</p>
        </div>

        <form className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-3 font-semibold text-white"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-cyan-300">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
