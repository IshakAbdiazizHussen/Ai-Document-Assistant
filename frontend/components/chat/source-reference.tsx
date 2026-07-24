"use client";

import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatSource } from "@/lib/types/chat";

export function SourceReference({
  source,
  filename,
  onSelect,
}: {
  source: ChatSource;
  filename?: string;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={cn(
        "w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs transition-colors",
        onSelect && "hover:border-primary/40 hover:bg-muted/60",
      )}
    >
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <FileText className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{filename ?? source.document_id}</span>
        {source.page_number ? (
          <span className="shrink-0 font-normal text-muted-foreground">· p.{source.page_number}</span>
        ) : null}
      </span>
      <p className="mt-1 line-clamp-2 text-muted-foreground">&ldquo;{source.excerpt}&rdquo;</p>
    </button>
  );
}
