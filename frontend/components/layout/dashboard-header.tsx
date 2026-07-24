"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useLogout } from "@/hooks/use-auth";

export function DashboardHeader({
  title,
  backHref,
  actions,
}: {
  title: ReactNode;
  backHref?: string;
  actions?: ReactNode;
}) {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const router = useRouter();

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
        <button
          type="button"
          onClick={() => logout(undefined, { onSuccess: () => router.push("/") })}
          disabled={isLoggingOut}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
