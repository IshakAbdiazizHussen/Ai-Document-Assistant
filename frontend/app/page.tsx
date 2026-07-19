import { ArrowRight, FileText, MessageSquare, Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileText,
    title: "Upload anything",
    description: "PDF, DOCX, or plain text — drop a file in and it's ready to search in moments.",
  },
  {
    icon: Search,
    title: "Grounded retrieval",
    description: "Answers are pulled from the exact passages in your documents, not guessed from memory.",
  },
  {
    icon: MessageSquare,
    title: "Just ask",
    description: "Chat naturally and get answers with references back to the source material.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Ask your documents anything.
        </h1>
        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          Upload a document and chat with an AI assistant that answers
          strictly from its content — grounded, accurate, and always
          traceable back to the source.
        </p>
        <Button render={<Link href="/dashboard" />} nativeButton={false} size="lg">
          Get Started
          <ArrowRight className="size-4" />
        </Button>
      </section>

      <section className="grid gap-6 pb-20 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex flex-col gap-3 rounded-lg border border-border p-6"
          >
            <Icon className="size-5 text-primary" />
            <h2 className="font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
