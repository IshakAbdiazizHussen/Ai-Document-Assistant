import { apiClient, ApiError } from "@/lib/api/client";
import type { DocumentPage, DocumentSummary } from "@/lib/types/document";

/**
 * Real implementation of the /documents API (docs/05-backend-remaining-features.md
 * Features 2-3). Same function signatures as the former documents.mock.ts,
 * so hooks/use-documents.ts only needed a one-line import change.
 */

export async function listDocuments(): Promise<DocumentSummary[]> {
  const { data } = await apiClient.get<DocumentSummary[]>("/documents");
  return data;
}

export async function uploadDocument(
  file: File,
  options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
): Promise<DocumentSummary> {
  const formData = new FormData();
  formData.append("file", file);
  // No manual Content-Type header: axios/the browser set
  // multipart/form-data with the correct boundary automatically for a
  // FormData body — setting it by hand would break the boundary.
  const { data } = await apiClient.post<DocumentSummary>("/documents/upload", formData, {
    signal: options?.signal,
    onUploadProgress: (event) => {
      if (!options?.onProgress || !event.total) return;
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
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

export async function getDocumentPage(
  id: string,
  pageNumber: number,
): Promise<DocumentPage | null> {
  try {
    const { data } = await apiClient.get<DocumentPage>(`/documents/${id}/pages/${pageNumber}`);
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function getDocumentDownloadUrl(id: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/documents/${id}/download`;
}
