"use client";

import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ChatSource } from "@/lib/types/chat";

export function SourceReference({ source }: { source: ChatSource }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full rounded-md border border-border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <FileText className="size-3 shrink-0" />
        <span className="truncate">Source: {source.document_id}</span>
        <ChevronDown
          className={cn("ml-auto size-3 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <p className="border-t border-border px-2 py-1.5 text-muted-foreground">
          {source.excerpt}
        </p>
      ) : null}
    </div>
  );
}
