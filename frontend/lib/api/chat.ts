import { apiClient } from "@/lib/api/client";
import type { ChatMessage, ChatResponse, ChatSource } from "@/lib/types/chat";

/**
 * Real implementation of the /chat API (docs/05-backend-remaining-features.md
 * Feature 7). Same function signatures as the former chat.mock.ts, so
 * hooks/use-chat.ts only needed a one-line import change.
 */

export async function sendMessage(
  sessionId: string | undefined,
  documentId: string | undefined,
  message: string,
): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/chat", {
    message,
    session_id: sessionId,
    document_id: documentId,
  });
  return data;
}

export async function getSessionMessages(
  sessionId: string | undefined,
): Promise<ChatMessage[]> {
  if (!sessionId) return [];
  // ChatMessageOut has no session_id field on each item (redundant with
  // the URL) — inject the one we already know so the shape still matches
  // the frontend's ChatMessage type.
  const { data } = await apiClient.get<Omit<ChatMessage, "session_id">[]>(
    `/chat/${sessionId}/messages`,
  );
  return data.map((message) => ({ ...message, session_id: sessionId }));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept to match the API's established signature; see comment below.
export async function getSourceDetails(chunkIds: string[]): Promise<ChatSource[]> {
  // The real backend has no endpoint to resolve a chunk_id back to its
  // excerpt/document_id after the fact — ChatMessageOut only persists
  // source_chunk_ids, not the source text (Feature 7). Full source
  // details only ever exist for the message just sent, from
  // ChatResponse.sources; hooks/use-chat.ts seeds the query cache with
  // that directly instead of calling this. Messages loaded from history
  // (e.g. after a reload) will show no source chips, which honestly
  // reflects what the real backend actually keeps.
  return [];
}
