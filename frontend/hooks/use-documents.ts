"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  deleteDocument,
  getDocument,
  listDocuments,
  uploadDocument,
} from "@/lib/api/documents.mock";
import type { DocumentSummary } from "@/lib/types/document";

const documentsKey = ["documents"] as const;

export function useDocuments() {
  return useQuery({
    queryKey: documentsKey,
    queryFn: listDocuments,
    refetchInterval: (query) => {
      const data = query.state.data as DocumentSummary[] | undefined;
      return data?.some((d) => d.status === "processing") ? 2000 : false;
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: [...documentsKey, id],
    queryFn: () => getDocument(id),
    enabled: Boolean(id),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey });
      toast.success("Document uploaded — processing started.");
    },
    onError: () => {
      toast.error("Upload failed. Please try again.");
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey });
      toast.success("Document deleted.");
    },
    onError: () => {
      toast.error("Failed to delete document.");
    },
  });
}
