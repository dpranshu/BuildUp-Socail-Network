import { AppShell } from "@/components/app-shell";

export default function CreatePage() {
  return (
    <AppShell title="Create post">
      <div className="rounded-3xl border border-white/10 bg-white/3 p-6">
        <form className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Post title</label>
            <input
              type="text"
              placeholder="What's the focus of your update?"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Content</label>
            <textarea
              rows={8}
              placeholder="Share what you're building, learning, or trying to figure out..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Tags</label>
            <input
              type="text"
              placeholder="#buildinpublic #creator #startup"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-3 font-semibold text-white"
            >
              Publish post
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
