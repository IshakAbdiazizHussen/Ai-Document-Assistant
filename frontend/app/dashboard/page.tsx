"use client";

import { FileText, LayoutGrid, List, Plus, Search, Upload, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentGridCard } from "@/components/documents/document-grid-card";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/use-documents";
import type { DocumentStatus, DocumentSummary } from "@/lib/types/document";

const uploadButtonClass =
  "flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:pointer-events-none disabled:opacity-60";

type StatusFilter = "all" | DocumentStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "processing", label: "Processing" },
  { key: "failed", label: "Error" },
];

export default function DashboardPage() {
  const { data: documents, isPending, isError, refetch } = useDocuments();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);

  const filtered = useMemo(() => {
    if (!documents) return [];
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesQuery = !query || doc.filename.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [documents, search, statusFilter]);

  function openUpload(files?: File[]) {
    setInitialFiles(files ?? []);
    setUploadOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Documents"
        actions={
          <>
            <div className="relative hidden min-[960px]:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-40 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-violet-500/60 sm:w-64"
              />
            </div>
            <button
              onClick={() => openUpload()}
              className={cn(uploadButtonClass, "hidden min-[960px]:flex")}
            >
              <Upload className="size-4" />
              Upload
            </button>
            <button
              onClick={() => openUpload()}
              aria-label="Upload document"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500 min-[960px]:hidden"
            >
              <Plus className="size-5" />
            </button>
          </>
        }
      />

      <div className="flex flex-1 flex-col p-4 sm:p-6">
        {isPending ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg bg-white/5" />
            ))}
          </div>
        ) : isError ? (
          <div className="m-auto flex flex-col items-center gap-2 text-center">
            <UploadCloud className="size-6 text-zinc-500" />
            <p className="font-medium text-white">Couldn&rsquo;t load documents</p>
            <p className="max-w-xs text-sm text-zinc-500">
              Something went wrong fetching your documents.
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm font-medium text-violet-400 underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => openUpload()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openUpload();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              openUpload(Array.from(e.dataTransfer.files));
            }}
            className="m-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 p-10 text-center transition-colors hover:bg-white/3"
          >
            <span className="flex size-14 items-center justify-center rounded-xl border border-dashed border-white/15 text-zinc-500">
              <Upload className="size-5" />
            </span>
            <div className="space-y-1.5">
              <p className="font-semibold text-white">Upload your first document</p>
              <p className="text-sm text-zinc-400">
                PDF, DOCX, or TXT files up to 20MB. We&rsquo;ll read and index them
                right away.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openUpload();
              }}
              className={cn(uploadButtonClass, "px-6")}
            >
              Upload document
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 min-[960px]:hidden">
              {filtered.map((document) => (
                <MobileDocumentRow key={document.id} document={document} />
              ))}
            </div>

            <div className="hidden min-[960px]:block">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map(({ key, label }) => {
                  const count =
                    key === "all"
                      ? documents.length
                      : documents.filter((d) => d.status === key).length;
                  const active = statusFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-violet-600/15 font-semibold text-violet-400"
                          : "text-zinc-400 hover:text-zinc-200",
                      )}
                    >
                      {key === "all" ? `${label} (${count})` : label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  aria-label="Grid view"
                  onClick={() => setView("grid")}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    view === "grid" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  aria-label="List view"
                  onClick={() => setView("list")}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    view === "list" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="mt-12 text-center text-sm text-zinc-500">
                No documents match &ldquo;{search}&rdquo;.
              </p>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((document) => (
                  <DocumentGridCard key={document.id} document={document} />
                ))}
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
                {filtered.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            )}
            </div>
          </>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} initialFiles={initialFiles} />
    </div>
  );
}

function MobileDocumentRow({ document }: { document: DocumentSummary }) {
  return (
    <Link
      href={`/dashboard/documents/${document.id}`}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{document.filename}</p>
        <p className="truncate text-xs text-zinc-500">
          {document.page_count ? `${document.page_count} pages · ` : ""}
          {formatRelativeTime(document.created_at)}
        </p>
      </div>
      <DocumentStatusBadge status={document.status} />
    </Link>
  );
}
