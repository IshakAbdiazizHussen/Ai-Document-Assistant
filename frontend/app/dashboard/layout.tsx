"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { MobileTabBar, Sidebar } from "@/components/layout/sidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, isPending } = useCurrentUser();
  const isDocumentDetailRoute = pathname.startsWith("/dashboard/documents/");

  useEffect(() => {
    if (!isPending && user === null) {
      router.replace("/");
    }
  }, [isPending, user, router]);

  if (isPending || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={cn(
            "flex flex-1 flex-col overflow-y-auto",
            isDocumentDetailRoute
              ? "bg-zinc-950 text-zinc-200"
              : "bg-white text-zinc-700 pb-16 dark:bg-zinc-950 dark:text-zinc-200 min-[960px]:pb-0",
          )}
        >
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
