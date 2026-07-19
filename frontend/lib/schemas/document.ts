import { z } from "zod";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export const uploadFileSchema = z.object({
  file: z
    .instanceof(File, { message: "Select a file to upload." })
    .refine((file) => ACCEPTED_TYPES.includes(file.type), {
      message: "Only PDF, DOCX, or TXT files are supported.",
    })
    .refine((file) => file.size <= MAX_SIZE_BYTES, {
      message: "File must be 20MB or smaller.",
    }),
});

export type UploadFileValues = z.infer<typeof uploadFileSchema>;
