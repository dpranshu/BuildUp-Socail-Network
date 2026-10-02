import { AppShell } from "@/components/app-shell";
import { profileData } from "@/data/mock";

export default function ProfilePage() {
  return (
    <AppShell title="Profile">
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/3 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400" />
              <div>
                <h2 className="text-2xl font-bold">{profileData.name}</h2>
                <div className="text-sm text-slate-400">{profileData.handle}</div>
              </div>
            </div>

            <button className="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Edit profile
            </button>
          </div>

          <p className="mt-5 max-w-2xl text-slate-300">{profileData.role}</p>
          <p className="mt-3 max-w-2xl leading-7 text-slate-400">{profileData.bio}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {Object.entries(profileData.stats).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="text-2xl font-black">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{key}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/3 p-6">
          <h3 className="mb-4 text-xl font-bold">Recent posts</h3>
          <div className="space-y-4">
            {[
              "I am learning how to turn an idea into a real product. This week is all about user interviews.",
              "My honest take: building in public feels scary, but it also gives me feedback faster than anything else.",
              "Looking for a collaborator on a clean portfolio project for a creator brand.",
            ].map((post) => (
              <div key={post} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-slate-300">
                {post}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
