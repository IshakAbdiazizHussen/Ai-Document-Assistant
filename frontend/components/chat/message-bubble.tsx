"use client";

import { SourceReference } from "@/components/chat/source-reference";
import { useMessageSources } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types/chat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const { data: sources } = useMessageSources(message.source_chunk_ids);

  return (
    <div
      className={cn(
        "flex max-w-[80%] flex-col gap-1.5",
        isUser ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {message.content}
      </div>
      {!isUser && sources && sources.length > 0 ? (
        <div className="flex w-full flex-col gap-1">
          {sources.map((source) => (
            <SourceReference key={source.chunk_id} source={source} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
