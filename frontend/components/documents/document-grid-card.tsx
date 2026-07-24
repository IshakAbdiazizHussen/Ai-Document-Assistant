"use client";

import { FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/api/client";
import { useDeleteDocument } from "@/hooks/use-documents";
import type { DocumentSummary } from "@/lib/types/document";

export function DocumentGridCard({ document }: { document: DocumentSummary }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    mutate: deleteDoc,
    isPending: isDeleting,
    error: deleteError,
    reset: resetDelete,
  } = useDeleteDocument();

  return (
    <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/20">
      <Link href={`/dashboard/documents/${document.id}`} className="block">
        <div
          className="flex h-32 items-center justify-center bg-zinc-100 dark:bg-zinc-900"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 10px)",
          }}
        >
          <FileText className="size-8 text-zinc-400 dark:text-zinc-700" />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{document.filename}</p>
          <p className="text-xs text-zinc-500">
            {formatFileSize(document.file_size_bytes)} · {formatRelativeTime(document.created_at)}
          </p>
          <DocumentStatusBadge status={document.status} />
        </div>
      </Link>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) resetDelete();
        }}
      >
        <DialogTrigger
          render={
            <button
              aria-label={`Delete ${document.filename}`}
              className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-lg bg-white/90 text-zinc-500 opacity-0 backdrop-blur-sm transition-opacity hover:bg-white hover:text-zinc-900 group-hover:opacity-100 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-white"
            />
          }
        >
          <Trash2 className="size-4" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This permanently removes &ldquo;{document.filename}&rdquo; and its
              indexed content. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{getErrorMessage(deleteError)}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() =>
                deleteDoc(document.id, { onSuccess: () => setConfirmOpen(false) })
              }
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
