"use client";

import { ChevronDown, Disc, File, LogOut, MessageSquare, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    icon: Disc,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/settings"),
  },
];

function formatGB(bytes: number) {
  return (bytes / 1024 ** 3).toFixed(1);
}

function WorkspaceSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 text-left outline-none hover:bg-white/5 data-popup-open:bg-white/5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
            A
          </span>
          <span className="truncate text-[15px] font-bold text-white">
            AI Document Assistant
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 border border-white/10 bg-zinc-900 text-zinc-200" sideOffset={4}>
        <DropdownMenuItem
          className="focus:bg-white/10 focus:text-white"
          onClick={() => mounted && setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          Toggle theme
        </DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-white/10 focus:text-white" render={<Link href="/" />}>
          Visit website
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none hover:bg-white/5 data-popup-open:bg-white/5">
        <Avatar size="sm">
          <AvatarFallback className="bg-zinc-800 text-white">
            <User className="size-3.5" />
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 border border-white/10 bg-zinc-900 text-zinc-200" side="top" sideOffset={4}>
        <p className="truncate px-1.5 py-1 text-xs text-zinc-500">{email}</p>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className="focus:bg-white/10 focus:text-white"
          onClick={() => {
            navigator.clipboard.writeText(email);
            toast.success("Email copied.");
          }}
        >
          Copy email
        </DropdownMenuItem>
        <DropdownMenuItem
          className="focus:bg-white/10 focus:text-white"
          render={<Link href="/dashboard/settings" />}
        >
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          variant="destructive"
          className="focus:bg-destructive/10"
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

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-200">
      <WorkspaceSwitcher />

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon, isActive }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200",
              isActive(pathname) && "bg-violet-950/60 font-semibold text-violet-400 hover:bg-violet-950/60 hover:text-violet-400",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Storage</span>
            <span>
              {formatGB(usedBytes)}/{formatGB(STORAGE_QUOTA_BYTES)} GB
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 min-[960px]:flex">
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
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/10 bg-zinc-950 pb-[env(safe-area-inset-bottom)] min-[960px]:hidden">
      {mobileTabs.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-violet-400" : "text-zinc-500",
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
