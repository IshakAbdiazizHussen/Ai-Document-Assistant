import { apiClient, ApiError } from "@/lib/api/client";
import type { DocumentSummary } from "@/lib/types/document";

/**
 * Real implementation of the /documents API (docs/05-backend-remaining-features.md
 * Features 2-3). Same function signatures as the former documents.mock.ts,
 * so hooks/use-documents.ts only needed a one-line import change.
 */

export async function listDocuments(): Promise<DocumentSummary[]> {
  const { data } = await apiClient.get<DocumentSummary[]>("/documents");
  return data;
}

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const formData = new FormData();
  formData.append("file", file);
  // No manual Content-Type header: axios/the browser set
  // multipart/form-data with the correct boundary automatically for a
  // FormData body — setting it by hand would break the boundary.
  const { data } = await apiClient.post<DocumentSummary>("/documents/upload", formData);
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

export async function getDocument(id: string): Promise<DocumentSummary | undefined> {
  try {
    const { data } = await apiClient.get<DocumentSummary>(`/documents/${id}`);
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}
