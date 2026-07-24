"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthDialog, type AuthView } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { marketingNavLinks } from "@/lib/marketing-nav";

export function Navbar() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");

  function openAuth(view: AuthView) {
    setAuthView(view);
    setAuthOpen(true);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
            A
          </span>
          <span className="text-lg font-bold text-zinc-900 dark:text-white">AI Document Assistant</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {marketingNavLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => openAuth("login")}
            className="h-10 rounded-lg bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-500"
          >
            Log in
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultView={authView} />
    </header>
  );
}
