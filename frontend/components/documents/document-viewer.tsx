"use client";

import { ChevronLeft, Download, FileX2, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import { useDocumentPage } from "@/hooks/use-documents";
import type { DocumentSummary } from "@/lib/types/document";

export interface FocusedSource {
  pageNumber: number;
  excerpt: string;
}

export function DocumentViewer({
  document,
  focusedSource,
  onClose,
}: {
  document: DocumentSummary | undefined;
  focusedSource: FocusedSource | null;
  onClose?: () => void;
}) {
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (focusedSource) setPageNumber(focusedSource.pageNumber);
  }, [focusedSource]);

  const { data: page, isPending, isError } = useDocumentPage(document?.id, pageNumber);
  const totalPages = document?.page_count ?? undefined;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {onClose ? (
            <button
              onClick={onClose}
              aria-label="Back to chat"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {document?.filename ?? "Select a document"}
            </p>
            <p className="text-xs text-zinc-500">
              {totalPages ? `Page ${pageNumber} of ${totalPages}` : "Preview unavailable"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center text-xs text-zinc-400">{zoom}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Plus className="size-3.5" />
          </button>
          {document ? (
            <a
              href={getDocumentDownloadUrl(document.id)}
              download
              aria-label="Download original file"
              className="ml-1 flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <Download className="size-3.5" />
            </a>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {!document ? null : isPending ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <Skeleton className="h-3 w-full bg-white/5" />
            <Skeleton className="h-3 w-4/5 bg-white/5" />
            <Skeleton className="h-3 w-3/5 bg-white/5" />
          </div>
        ) : isError || !page ? (
          <div className="m-auto flex max-w-xs flex-col items-center gap-2 pt-16 text-center">
            <FileX2 className="size-6 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">No preview available</p>
            <p className="text-xs text-zinc-500">
              This document was processed before the reading view existed. Re-upload it to enable
              page previews.
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-900/40 p-8">
            <PageText text={page.text} highlight={focusedSource?.excerpt} zoom={zoom} />
          </div>
        )}
      </div>
    </div>
  );
}

function PageText({ text, highlight, zoom }: { text: string; highlight?: string; zoom: number }) {
  const style = { fontSize: `${zoom}%` };
  let searchFor = highlight;
  if (searchFor?.endsWith("...")) {
    searchFor = searchFor.slice(0, -3).trimEnd();
    // The backend truncates excerpts at a fixed character count, which can
    // land mid-word — trim back to the last full word so the highlighted
    // quote doesn't end on a fragment.
    const lastSpace = searchFor.lastIndexOf(" ");
    if (lastSpace > 0) searchFor = searchFor.slice(0, lastSpace);
  }
  const index = searchFor ? text.indexOf(searchFor) : -1;

  if (!searchFor || index === -1) {
    return (
      <p style={style} className="leading-relaxed whitespace-pre-wrap text-zinc-300">
        {text}
      </p>
    );
  }

  const before = text.slice(0, index);
  const after = text.slice(index + searchFor.length);

  return (
    <p style={style} className="leading-relaxed whitespace-pre-wrap text-zinc-300">
      {before}
      <span className="my-3 block">
        <span className="mb-1.5 block text-xs font-semibold tracking-wide text-violet-400">
          CITED IN ANSWER
        </span>
        <span className="block rounded-md border-l-2 border-violet-500 bg-violet-950/40 px-4 py-3 text-zinc-100">
          &ldquo;{searchFor}&rdquo;
        </span>
      </span>
      {after}
    </p>
  );
}
