import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";

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
    <header className="sticky top-0 z-30 flex h-20 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 sm:px-8 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : null}
        <h1 className="truncate text-2xl font-bold text-zinc-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
