import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function MessagesPage() {
  return (
    <AppShell title="Messages">
      <section className="px-5 pb-12 pt-6 sm:px-0">
        <h1 className="font-display text-xl font-semibold">Messages</h1>
        <div className="flex flex-col items-center px-5 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border hairline bg-white/[0.04] text-[var(--muted)]">
            <MessageCircle size={21} strokeWidth={1.7} />
          </span>
          <p className="mt-4 text-sm font-medium">Messages are coming soon.</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">
            Private conversations with other creators will show up here.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
