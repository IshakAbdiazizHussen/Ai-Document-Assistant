"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getSessionMessages, getSourceDetails, sendMessage } from "@/lib/api/chat.mock";
import type { ChatResponse } from "@/lib/types/chat";

const chatMessagesKey = (sessionId: string | undefined) =>
  ["chat-messages", sessionId] as const;

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
    },
    onError: () => {
      toast.error("Failed to send message. Please try again.");
    },
  });
}

export function useMessageSources(sourceChunkIds: string[] | undefined) {
  return useQuery({
    queryKey: ["chat-message-sources", sourceChunkIds ?? []],
    queryFn: () => getSourceDetails(sourceChunkIds ?? []),
    enabled: Boolean(sourceChunkIds?.length),
  });
}
