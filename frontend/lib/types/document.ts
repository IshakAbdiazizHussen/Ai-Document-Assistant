export type DocumentStatus = "processing" | "ready" | "failed";

export interface DocumentSummary {
  id: string;
  filename: string;
  status: DocumentStatus;
  created_at: string;
}
