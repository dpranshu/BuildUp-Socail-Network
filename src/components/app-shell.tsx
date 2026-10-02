import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/feed", label: "Home" },
  { href: "/profile", label: "Profile" },
  { href: "/create", label: "Create" },
  { href: "/login", label: "Login" },
];

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/feed" className="text-lg font-bold tracking-tight">
            build<span className="text-cyan-400">in</span>public
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-300 transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/create"
            className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
          >
            New post
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="hidden h-fit rounded-3xl border border-white/10 bg-white/3 p-4 lg:block">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Explore
          </p>
          <div className="space-y-2">
            {[
              "#buildinpublic",
              "#design",
              "#startup",
              "#travel",
              "#ai",
              "#creator",
            ].map((tag) => (
              <Link
                key={tag}
                href="/feed"
                className="block rounded-2xl border border-white/5 bg-slate-900/70 px-3 py-2 text-sm text-slate-300 transition hover:border-white/10 hover:text-white"
              >
                {tag}
              </Link>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          </div>
          {children}
        </main>

        <aside className="hidden h-fit rounded-3xl border border-white/10 bg-white/3 p-4 xl:block">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Trending
          </p>

          <div className="space-y-4">
            {[
              { name: "Ari Bloom", detail: "building a creator CRM" },
              { name: "Noah Lane", detail: "travel + remote life" },
              { name: "Mila Sato", detail: "UX for indie products" },
            ].map((person) => (
              <div key={person.name} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <div className="font-medium">{person.name}</div>
                <div className="text-sm text-slate-400">{person.detail}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
