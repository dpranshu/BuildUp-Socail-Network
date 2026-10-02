import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/4 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="mb-7 text-center">
          <div className="text-2xl font-black tracking-tight">
            build<span className="text-cyan-400">in</span>public
          </div>
          <p className="mt-2 text-sm text-slate-400">Create your creator account</p>
        </div>

        <form className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Full name</label>
            <input
              type="text"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              placeholder="Create a strong password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 font-semibold text-white"
          >
            Create account
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-violet-300">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
