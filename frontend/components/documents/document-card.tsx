"use client";

import { FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDeleteDocument } from "@/hooks/use-documents";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/lib/types/document";

export function DocumentCard({
  document,
  active,
}: {
  document: DocumentSummary;
  active?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: deleteDoc, isPending: isDeleting } = useDeleteDocument();

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50",
        active && "border-primary bg-muted/50",
      )}
    >
      <Link
        href={`/dashboard/documents/${document.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{document.filename}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(document.created_at).toLocaleString()}
          </p>
        </div>
      </Link>
      <DocumentStatusBadge status={document.status} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${document.filename}`}
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
