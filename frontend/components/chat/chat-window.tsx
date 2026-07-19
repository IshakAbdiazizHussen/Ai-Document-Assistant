"use client";

import { AlertCircle, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/client";
import { useChatMessages, useSendMessage } from "@/hooks/use-chat";

function sessionStorageKey(documentId: string) {
  return `ai-doc-assistant:chat-session:${documentId}`;
}

export function ChatWindow({ documentId }: { documentId?: string }) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!documentId) {
      setSessionId(undefined);
      return;
    }
    setSessionId(window.localStorage.getItem(sessionStorageKey(documentId)) ?? undefined);
  }, [documentId]);

  const hasSession = Boolean(sessionId);
  const { data: messages, isPending, isError, refetch } = useChatMessages(sessionId);
  const { mutate: send, isPending: isSending, error: sendError } = useSendMessage();

  const messageList = messages ?? [];
  const showSkeleton = hasSession && isPending;
  const showError = hasSession && isError;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList.length, isSending]);

  if (!documentId) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No document selected"
        description="Select or upload a document to start chatting."
      />
    );
  }

  function handleSend(message: string) {
    send(
      { sessionId, documentId, message },
      {
        onSuccess: (response) => {
          if (!sessionId && documentId) {
            window.localStorage.setItem(sessionStorageKey(documentId), response.session_id);
            setSessionId(response.session_id);
          }
        },
      },
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex min-h-full flex-col gap-4 p-1">
          {showSkeleton ? (
            <>
              <Skeleton className="h-12 w-2/3 self-end rounded-lg" />
              <Skeleton className="h-16 w-2/3 self-start rounded-lg" />
            </>
          ) : showError ? (
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load messages"
              description="Something went wrong loading this conversation."
              action={
                <button
                  onClick={() => refetch()}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Try again
                </button>
              }
            />
          ) : messageList.length > 0 ? (
            messageList.map((message) => <MessageBubble key={message.id} message={message} />)
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Ask a question about this document to get started."
            />
          )}
          {isSending ? <ThinkingIndicator /> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      {sendError ? (
        <p className="text-xs text-destructive">{getErrorMessage(sendError)}</p>
      ) : null}
      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <span className="flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current" />
      </span>
      Thinking…
    </div>
  );
}
