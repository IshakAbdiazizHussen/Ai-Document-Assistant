import { FileText } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FileText className="size-5 text-primary" />
          <span>AI Document Assistant</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Settings
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
