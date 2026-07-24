export type DocumentStatus = "processing" | "ready" | "failed";

export interface DocumentSummary {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  page_count: number | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
}

export interface DocumentPage {
  page_number: number;
  total_pages: number;
  text: string;
}
