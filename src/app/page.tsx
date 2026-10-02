const pillars = [
  {
    title: "Real over polished",
    text: "People share honest updates, failures, lessons, and wins without pretending to be perfect.",
    icon: "✍️",
  },
  {
    title: "Creator-first",
    text: "Built for people who make things, build projects, and turn ambition into action.",
    icon: "🚀",
  },
  {
    title: "Collaborate naturally",
    text: "Find peers, clients, teammates, and people who actually align with what you are building.",
    icon: "🤝",
  },
];

const stats = [
  { value: "Gen Z", label: "builders" },
  { value: "creator", label: "first" },
  { value: "text", label: "MVP" },
];

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-lg font-bold tracking-tight">
            build<span className="text-cyan-400">in</span>public
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#idea" className="transition hover:text-white">Idea</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#future" className="transition hover:text-white">Future</a>
          </nav>

          <a
            href="#waitlist"
            className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
          >
            Join waitlist
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-20 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              creator-first social network
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.08em] md:text-7xl">
              The internet for <span className="bg-gradient-to-r from-violet-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">real builders</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              A social platform for people who are building, learning, travelling,
              experimenting, creating, collaborating, and growing — without fake
              professionalism or curated perfection.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#waitlist"
                className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
              >
                Get early access
              </a>
              <a
                href="#idea"
                className="rounded-full border border-white/10 bg-white/3 px-6 py-3 font-semibold text-white transition hover:border-white/20 hover:bg-white/5"
              >
                See the vision
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-8">
              {stats.map((item) => (
                <div key={item.label}>
                  <div className="text-2xl font-black tracking-tight">{item.value}</div>
                  <div className="text-sm text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/4 p-3 shadow-2xl shadow-violet-500/10">
            <div className="rounded-[22px] border border-white/10 bg-slate-950/80 p-5">
              <div className="mb-5 flex items-center justify-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400" />
                    <div>
                      <div className="font-semibold">Ari</div>
                      <div className="text-xs text-slate-400">@studentbuilder</div>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-slate-200">
                    <span className="font-semibold text-white">Building my first product.</span>{" "}
                    Started with a landing page and now learning how to talk to users.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-200">
                      buildinpublic
                    </span>
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-violet-200">
                      founderjourney
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400" />
                    <div>
                      <div className="font-semibold">Mila</div>
                      <div className="text-xs text-slate-400">@designsprints</div>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-slate-200">
                    Looking for a dev to build a portfolio site for a creator brand. If you like clean UX and thoughtful systems, let&apos;s collab.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-200">
                      collab
                    </span>
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-violet-200">
                      design
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="idea" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">The Idea</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.06em] md:text-5xl">
            A place where people build in public.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/3 p-8">
            <p className="text-2xl font-semibold leading-relaxed tracking-[-0.04em] text-white md:text-3xl">
              “Not a fake professional network. A real creator network.”
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
            <ul className="space-y-4 text-slate-300">
              <li>• Share real projects, ideas, and personal growth.</li>
              <li>• Connect with peers, collaborators, and future clients.</li>
              <li>• Show expertise without fake corporate energy.</li>
              <li>• Build a digital identity rooted in real work.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Why it matters</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.06em] md:text-5xl">
            Built for creators, builders, and people who do things differently.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/3 p-6"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-xl">
                {item.icon}
              </div>
              <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
              <p className="text-slate-300 leading-7">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="future" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/3 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">MVP</p>
            <h3 className="mt-4 text-3xl font-black tracking-[-0.05em]">Text-first for now</h3>
            <ul className="mt-6 space-y-3 text-slate-300">
              <li>• posts and project updates</li>
              <li>• follower and interest network</li>
              <li>• likes, comments, and discussions</li>
              <li>• search by topic and creator</li>
              <li>• collaboration requests</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/85 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">Then expand</p>
            <h3 className="mt-4 text-3xl font-black tracking-[-0.05em]">Images, video, profiles, communities</h3>
            <p className="mt-6 text-slate-300 leading-7">
              After the first version proves the model, we can add richer media,
              creator portfolios, niche communities, and collaboration tools built for project-based growth.
            </p>
          </div>
        </div>
      </section>

      <section id="waitlist" className="mx-auto max-w-5xl px-6 pb-28 pt-16 text-center">
        <div className="rounded-[32px] border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-slate-900 to-cyan-500/10 p-10 md:p-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">Build in public</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.06em] md:text-6xl">
            Share the real journey.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            A social platform for ambitious people who are creating their own path instead of waiting for permission.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="mailto:hello@buildinpublic.com"
              className="rounded-full bg-white px-7 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
