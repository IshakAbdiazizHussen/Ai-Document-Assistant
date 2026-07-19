export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  source_chunk_ids?: string[];
  created_at: string;
}

export interface ChatSource {
  document_id: string;
  chunk_id: string;
  excerpt: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  session_id: string;
}
