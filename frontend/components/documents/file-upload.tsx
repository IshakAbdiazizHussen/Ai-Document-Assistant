"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { getErrorMessage } from "@/lib/api/client";
import { useUploadDocument } from "@/hooks/use-documents";
import { uploadFileSchema, type UploadFileValues } from "@/lib/schemas/document";
import { cn } from "@/lib/utils";

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { mutate, isPending, error, reset: resetMutation } = useUploadDocument();

  const {
    setValue,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UploadFileValues>({
    resolver: zodResolver(uploadFileSchema),
  });

  function submitFile(file: File | undefined) {
    if (!file) return;
    resetMutation();
    setValue("file", file, { shouldValidate: true });
    handleSubmit(({ file }) => {
      mutate(file, { onSuccess: () => reset() });
    })();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          submitFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center transition-colors",
          isDragging && "border-primary bg-muted/50",
          isPending && "pointer-events-none opacity-60",
        )}
      >
        {isPending ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {isPending ? "Uploading…" : "Drag a file here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT — up to 20MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="sr-only"
          onChange={(e) => submitFile(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{getErrorMessage(error)}</p>
      ) : errors.file ? (
        <p className="text-xs text-destructive">{errors.file.message}</p>
      ) : null}
    </div>
  );
}
