import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardHeader({
  title,
  backHref,
  actions,
}: {
  title: ReactNode;
  backHref?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-zinc-950 px-6 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : null}
        <h1 className="truncate text-2xl font-bold text-white">{title}</h1>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
