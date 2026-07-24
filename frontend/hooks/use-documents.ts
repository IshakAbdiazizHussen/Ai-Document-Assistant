"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api/client";
import {
  deleteDocument,
  getDocument,
  getDocumentPage,
  listDocuments,
  uploadDocument,
} from "@/lib/api/documents";
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

export function useDocumentPage(id: string | undefined, pageNumber: number | undefined) {
  return useQuery({
    queryKey: [...documentsKey, id, "pages", pageNumber],
    queryFn: () => getDocumentPage(id!, pageNumber!),
    enabled: Boolean(id) && Boolean(pageNumber),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey });
      toast.success("Document uploaded — processing started.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
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
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
