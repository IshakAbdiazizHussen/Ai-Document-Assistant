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
  page_number: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  session_id: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string | null;
  document_id: string | null;
  document_filename: string | null;
  message_count: number;
  last_message_preview: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
