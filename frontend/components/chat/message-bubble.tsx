"use client";

import { Fragment } from "react";

import { SourceReference } from "@/components/chat/source-reference";
import { useMessageSources } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSource } from "@/lib/types/chat";

const CITATION_PATTERN = /(\[\d+\])/g;

export function MessageBubble({
  message,
  documentFilename,
  onCiteClick,
}: {
  message: ChatMessage;
  documentFilename?: string;
  onCiteClick?: (source: ChatSource) => void;
}) {
  const isUser = message.role === "user";
  const { data: sources } = useMessageSources(message.source_chunk_ids);

  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1.5",
        isUser ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {isUser || !sources?.length
          ? message.content
          : renderWithCitations(message.content, sources, onCiteClick)}
      </div>
      {!isUser && sources && sources.length > 0 ? (
        <div className="flex w-full flex-col gap-1">
          <p className="px-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
            SOURCES
          </p>
          {sources.map((source) => (
            <SourceReference
              key={source.chunk_id}
              source={source}
              filename={documentFilename}
              onSelect={onCiteClick ? () => onCiteClick(source) : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function renderWithCitations(
  content: string,
  sources: ChatSource[],
  onCiteClick?: (source: ChatSource) => void,
) {
  const parts = content.split(CITATION_PATTERN);

  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    const source = match ? sources[Number(match[1]) - 1] : undefined;

    if (match && source) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onCiteClick?.(source)}
          disabled={!onCiteClick}
          className="mx-0.5 inline-flex size-4 -translate-y-px items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground align-middle hover:bg-primary/80"
        >
          {match[1]}
        </button>
      );
    }

    return <Fragment key={i}>{part}</Fragment>;
  });
}
