import type { DocumentSummary } from "@/lib/types/document";

/**
 * In-memory stand-in for the real /documents API (see docs/04-development-plan.md
 * Section 6). Replaced by lib/api/documents.ts (Axios) in Phase 6 once the
 * backend's document endpoints exist — hooks/use-documents.ts is the only
 * caller, so the swap is a one-file change.
 */

let documents: DocumentSummary[] = [];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  await delay(300);
  return [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  await delay(700);

  const doc: DocumentSummary = {
    id: crypto.randomUUID(),
    filename: file.name,
    status: "processing",
    created_at: new Date().toISOString(),
  };
  documents = [doc, ...documents];

  setTimeout(() => {
    documents = documents.map((d) =>
      d.id === doc.id
        ? { ...d, status: Math.random() > 0.15 ? "ready" : "failed" }
        : d,
    );
  }, 4000);

  return doc;
}

export async function deleteDocument(id: string): Promise<void> {
  await delay(300);
  documents = documents.filter((d) => d.id !== id);
}

export async function getDocument(id: string): Promise<DocumentSummary | undefined> {
  await delay(150);
  return documents.find((d) => d.id === id);
}
