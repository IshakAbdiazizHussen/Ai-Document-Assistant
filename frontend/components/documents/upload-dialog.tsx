"use client";

import { FileText, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadDocument } from "@/lib/api/documents";
import { getErrorMessage } from "@/lib/api/client";
import { useDocuments } from "@/hooks/use-documents";
import { uploadFileSchema } from "@/lib/schemas/document";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/lib/types/document";

type QueueStatus = "uploading" | "processing" | "ready" | "failed";

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  documentId?: string;
  error?: string;
}

export function UploadDialog({
  open,
  onOpenChange,
  initialFiles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFiles?: File[];
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllers = useRef(new Map<string, AbortController>());
  const queryClient = useQueryClient();
  const { data: liveDocuments } = useDocuments();

  // Seed the queue with files dropped directly on the empty-state dropzone
  // before the dialog was even open.
  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cross-reference the shared documents query (already polling while
  // anything is "processing") so each row reflects the document's real
  // ready/failed status without a second polling loop.
  useEffect(() => {
    if (!liveDocuments) return;
    setQueue((prev) =>
      prev.map((item) => {
        if (!item.documentId || item.status !== "processing") return item;
        const live = liveDocuments.find((d) => d.id === item.documentId);
        if (!live) return item;
        if (live.status === "ready") return { ...item, status: "ready" as const };
        if (live.status === "failed") {
          return {
            ...item,
            status: "failed" as const,
            error: live.error_message ?? "Processing failed.",
          };
        }
        return item;
      }),
    );
  }, [liveDocuments]);

  const isSettling = queue.some((i) => i.status === "uploading" || i.status === "processing");

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function startUpload(item: QueueItem) {
    const controller = new AbortController();
    abortControllers.current.set(item.id, controller);

    uploadDocument(item.file, {
      signal: controller.signal,
      onProgress: (progress) => {
        // Once every byte has left the client, the backend is extracting
        // and chunking the file before it responds (Feature 2's contract is
        // a single synchronous request) — reflect that as "processing"
        // rather than leaving the row looking stuck at 100%.
        updateItem(item.id, { progress, status: progress >= 100 ? "processing" : "uploading" });
      },
    })
      .then((document: DocumentSummary) => {
        updateItem(item.id, { status: "processing", documentId: document.id, progress: 100 });
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        updateItem(item.id, { status: "failed", error: getErrorMessage(error) });
      })
      .finally(() => {
        abortControllers.current.delete(item.id);
      });
  }

  function addFiles(files: File[]) {
    const newItems: QueueItem[] = files.map((file) => {
      const id = crypto.randomUUID();
      const result = uploadFileSchema.safeParse({ file });
      if (!result.success) {
        return {
          id,
          file,
          status: "failed",
          progress: 0,
          error: result.error.issues[0]?.message ?? "That file can't be uploaded.",
        };
      }
      return { id, file, status: "uploading", progress: 0 };
    });

    setQueue((prev) => [...prev, ...newItems]);
    newItems.filter((item) => item.status === "uploading").forEach(startUpload);
  }

  function retry(item: QueueItem) {
    updateItem(item.id, { status: "uploading", progress: 0, error: undefined });
    startUpload({ ...item, status: "uploading", progress: 0 });
  }

  function handleClose() {
    // Abort anything still in flight — already-uploaded documents stay (they're
    // real rows now), only the client → server transfer itself is cancelable.
    abortControllers.current.forEach((controller) => controller.abort());
    abortControllers.current.clear();
    setQueue([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-lg gap-0 border border-white/10 bg-zinc-950 p-0 text-white sm:max-w-lg"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
          <DialogTitle className="text-lg font-bold">Upload documents</DialogTitle>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-8 text-center transition-colors",
              isDragging && "border-violet-500/60 bg-white/3",
            )}
          >
            <UploadCloud className="size-6 text-zinc-500" />
            <p className="font-semibold text-white">Drag and drop files here, or click to browse</p>
            <p className="text-sm text-zinc-500">Supports PDF, DOCX, TXT — up to 20MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          {queue.length > 0 ? (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {queue.map((item) => (
                <QueueRow key={item.id} item={item} onRetry={() => retry(item)} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={isSettling}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QueueRow({ item, onRetry }: { item: QueueItem; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/2 px-3 py-2.5">
      <FileText className="mt-0.5 size-4 shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{item.file.name}</p>
          {item.status === "uploading" ? (
            <span className="shrink-0 text-xs text-zinc-400">{item.progress}%</span>
          ) : item.status === "ready" ? (
            <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Ready
            </span>
          ) : null}
        </div>

        {item.status === "uploading" ? (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-[width]"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        ) : item.status === "processing" ? (
          <p className="mt-0.5 text-xs text-amber-400">Processing — extracting text...</p>
        ) : item.status === "failed" ? (
          <p className="mt-0.5 text-xs text-red-400">
            Upload failed — {item.error}{" "}
            <button onClick={onRetry} className="underline underline-offset-2 hover:text-red-300">
              Retry
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
