"use client";

import { FileX2, Inbox } from "lucide-react";

import { DocumentCard } from "@/components/documents/document-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useDocuments } from "@/hooks/use-documents";

export function DocumentList({ activeId }: { activeId?: string }) {
  const { data: documents, isPending, isError, refetch } = useDocuments();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={FileX2}
        title="Couldn't load documents"
        description="Something went wrong fetching your documents."
        action={
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No documents yet"
        description="Upload a PDF, DOCX, or TXT file to get started."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          active={document.id === activeId}
        />
      ))}
    </div>
  );
}
