"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { useDocuments } from "@/hooks/use-documents";
import { cn } from "@/lib/utils";

export function DocumentLibrary({ activeId }: { activeId: string }) {
  const { data: documents } = useDocuments();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!documents) return [];
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) => doc.filename.toLowerCase().includes(query));
  }, [documents, search]);

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-zinc-950 md:flex">
      <div className="shrink-0 border-b border-white/10 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            placeholder="Search library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/60"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {filtered.map((doc) => {
          const active = doc.id === activeId;
          return (
            <Link
              key={doc.id}
              href={`/dashboard/documents/${doc.id}`}
              className={cn(
                "rounded-lg border px-3 py-2.5 transition-colors",
                active
                  ? "border-violet-500/30 bg-violet-950/40"
                  : "border-transparent hover:bg-white/5",
              )}
            >
              <p
                className={cn(
                  "truncate text-sm font-semibold",
                  active ? "text-violet-300" : "text-zinc-200",
                )}
              >
                {doc.filename}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                {doc.page_count ? <span>{doc.page_count} pages</span> : null}
                {doc.page_count ? <span>·</span> : null}
                <DocumentStatusBadge status={doc.status} />
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
