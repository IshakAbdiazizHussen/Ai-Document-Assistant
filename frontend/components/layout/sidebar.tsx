"use client";

import { ChevronDown, File, LogOut, MessageSquare, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useDocuments } from "@/hooks/use-documents";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

// No storage plan/quota exists on the backend yet; this cap is a UI
// placeholder so the meter has something to fill against. The numerator
// (bytes used) is always real, summed from actual uploaded file sizes.
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

const navItems = [
  {
    href: "/dashboard",
    label: "Documents",
    icon: File,
    isActive: (pathname: string) =>
      pathname === "/dashboard" || pathname.startsWith("/dashboard/documents"),
  },
  {
    href: "/dashboard/conversations",
    label: "Conversations",
    icon: MessageSquare,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/conversations"),
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/settings"),
  },
];

function WorkspaceSwitcher({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 text-left outline-none hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-white/5"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
          A
        </span>
        <span className="truncate text-[15px] font-bold text-zinc-900 dark:text-white">
          AI Document Assistant
        </span>
      </span>
      <ChevronDown
        className={cn("size-4 shrink-0 text-zinc-500 transition-transform", !open && "-rotate-90")}
      />
    </button>
  );
}

function AccountMenu() {
  const { data: user } = useCurrentUser();
  const { mutate: logout } = useLogout();
  const router = useRouter();

  const email = user?.email ?? "";
  const label = user?.full_name || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none hover:bg-zinc-100 data-popup-open:bg-zinc-100 dark:hover:bg-white/5 dark:data-popup-open:bg-white/5">
        <Avatar size="sm">
          <AvatarFallback className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-white">
            <User className="size-3.5" />
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-white">
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" side="top" sideOffset={4}>
        <p className="truncate px-1.5 py-1 text-xs text-muted-foreground">{email}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(email);
            toast.success("Email copied.");
          }}
        >
          Copy email
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => logout(undefined, { onSuccess: () => router.push("/") })}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: documents } = useDocuments();
  const usedBytes = documents?.reduce((sum, doc) => sum + doc.file_size_bytes, 0) ?? 0;
  const usedPercent = Math.min(100, (usedBytes / STORAGE_QUOTA_BYTES) * 100);
  const [navOpen, setNavOpen] = useState(true);

  return (
    <div className="flex h-full flex-col bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <WorkspaceSwitcher open={navOpen} onToggle={() => setNavOpen((v) => !v)} />

      {navOpen ? (
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map(({ href, label, icon: Icon, isActive }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200",
                isActive(pathname) &&
                  "bg-violet-100 font-semibold text-violet-700 hover:bg-violet-100 hover:text-violet-700 dark:bg-violet-950/60 dark:text-violet-400 dark:hover:bg-violet-950/60 dark:hover:text-violet-400",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex-1" />

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>Storage</span>
            <span>
              {formatFileSize(usedBytes)} / {formatFileSize(STORAGE_QUOTA_BYTES)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>

        <AccountMenu />
      </div>
    </div>
  );
}

// The document + chat view (both its mobile and desktop layouts) is a
// focused, full-viewport experience with no persistent app chrome — matches
// the reference design, and also avoids the app sidebar's fixed width
// competing with the document library / chat panes for space right at the
// 960px breakpoint.
function isDocumentDetailRoute(pathname: string) {
  return pathname.startsWith("/dashboard/documents/");
}

export function Sidebar() {
  const pathname = usePathname();
  if (isDocumentDetailRoute(pathname)) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 min-[960px]:flex dark:border-white/10">
      <SidebarNav />
    </aside>
  );
}

const mobileTabs = [
  {
    href: "/dashboard",
    label: "Documents",
    icon: File,
    isActive: (pathname: string) =>
      pathname === "/dashboard" || pathname.startsWith("/dashboard/documents"),
  },
  {
    href: "/dashboard/conversations",
    label: "Chats",
    icon: MessageSquare,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/conversations"),
  },
  {
    href: "/dashboard/settings",
    label: "Profile",
    icon: User,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/settings"),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (isDocumentDetailRoute(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] min-[960px]:hidden dark:border-white/10 dark:bg-zinc-950">
      {mobileTabs.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-violet-600 dark:text-violet-400" : "text-zinc-500",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
