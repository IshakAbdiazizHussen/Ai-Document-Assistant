"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api/client";
import { getSessionMessages, getSourceDetails, sendMessage } from "@/lib/api/chat";
import type { ChatResponse } from "@/lib/types/chat";

const chatMessagesKey = (sessionId: string | undefined) =>
  ["chat-messages", sessionId] as const;

const chatSourcesKey = (chunkIds: string[]) => ["chat-message-sources", chunkIds] as const;

export function useChatMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: chatMessagesKey(sessionId),
    queryFn: () => getSessionMessages(sessionId),
    enabled: Boolean(sessionId),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      documentId,
      message,
    }: {
      sessionId: string | undefined;
      documentId: string | undefined;
      message: string;
    }) => sendMessage(sessionId, documentId, message),
    onSuccess: (response: ChatResponse) => {
      queryClient.invalidateQueries({ queryKey: chatMessagesKey(response.session_id) });

      // Full source excerpts only ever exist right here, on the response
      // to the message just sent (the real backend has no way to resolve
      // them again later — see lib/api/chat.ts getSourceDetails). Seed the
      // cache directly so this turn's MessageBubble renders them without
      // a follow-up call that would just return nothing.
      if (response.sources.length > 0) {
        const chunkIds = response.sources.map((source) => source.chunk_id);
        queryClient.setQueryData(chatSourcesKey(chunkIds), response.sources);
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useMessageSources(sourceChunkIds: string[] | undefined) {
  return useQuery({
    queryKey: chatSourcesKey(sourceChunkIds ?? []),
    queryFn: () => getSourceDetails(sourceChunkIds ?? []),
    enabled: Boolean(sourceChunkIds?.length),
  });
}
