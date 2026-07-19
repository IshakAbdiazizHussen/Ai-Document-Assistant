"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SendHorizontal } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatMessageSchema, type ChatMessageValues } from "@/lib/schemas/chat";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChatMessageValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { message: "" },
  });

  function onSubmit({ message }: ChatMessageValues) {
    onSend(message);
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <Textarea
          {...register("message")}
          placeholder="Ask a question about this document…"
          disabled={disabled}
          className="min-h-10"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(onSubmit)();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={disabled} aria-label="Send message">
          <SendHorizontal className="size-4" />
        </Button>
      </div>
      {errors.message ? (
        <p className="text-xs text-destructive">{errors.message.message}</p>
      ) : null}
    </form>
  );
}
