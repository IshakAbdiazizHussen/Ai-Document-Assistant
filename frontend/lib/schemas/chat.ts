import { z } from "zod";

// Mirrors the backend's chat_message_max_length setting (default 4000) —
// this is a client-side UX guard, not the source of truth; the backend
// still enforces its own limit.
const MAX_MESSAGE_LENGTH = 4000;

export const chatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a message before sending.")
    .max(MAX_MESSAGE_LENGTH, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`),
});

export type ChatMessageValues = z.infer<typeof chatMessageSchema>;
