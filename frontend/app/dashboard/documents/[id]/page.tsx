"use client";

import { ChevronDown, ChevronLeft, FileText, Plus } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ChatWindow } from "@/components/chat/chat-window";
import { DocumentLibrary } from "@/components/documents/document-library";
import { DocumentViewer, type FocusedSource } from "@/components/documents/document-viewer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useChatSessions } from "@/hooks/use-chat";
import { useDocument } from "@/hooks/use-documents";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ChatSource } from "@/lib/types/chat";

function sessionStorageKey(documentId: string) {
  return `ai-doc-assistant:chat-session:${documentId}`;
}

export default function DashboardDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: document } = useDocument(id);
  const { data: sessions } = useChatSessions();
  const isDesktop = useMediaQuery("(min-width: 960px)");

  const [focusedSource, setFocusedSource] = useState<FocusedSource | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sessionParam = searchParams.get("session");
  const forceNew = searchParams.get("new") === "1";
  const initialSessionId = forceNew ? "" : (sessionParam ?? undefined);

  const activeSession = sessions?.find((s) => s.id === activeSessionId);
  const conversationTitle = activeSession?.title ?? document?.filename ?? "Conversation";

  function handleCiteClick(source: ChatSource) {
    if (!source.page_number) return;
    setFocusedSource({ pageNumber: source.page_number, excerpt: source.excerpt });
    setSheetOpen(true);
  }

  function handleNewConversation() {
    window.localStorage.removeItem(sessionStorageKey(id));
    setFocusedSource(null);
    setActiveSessionId(undefined);
    setChatKey((k) => k + 1);
    router.replace(`/dashboard/documents/${id}`);
  }

  if (!isDesktop) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <button
            onClick={() => router.push("/dashboard")}
            aria-label="Back"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-white">
            {conversationTitle}
          </h1>
          <button
            aria-label="New conversation"
            onClick={handleNewConversation}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Plus className="size-4" />
          </button>
        </header>

        {document ? (
          <button
            onClick={() => setSheetOpen(true)}
            className="mx-4 mt-3 flex shrink-0 items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left"
          >
            <FileText className="size-4 shrink-0 text-zinc-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
              {document.filename}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-violet-400">
              View document
              <ChevronDown className="size-3.5" />
            </span>
          </button>
        ) : null}

        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <ChatWindow
            key={chatKey}
            documentId={id}
            documentFilename={document?.filename}
            initialSessionId={initialSessionId}
            onCiteClick={handleCiteClick}
            onSessionChange={setActiveSessionId}
          />
        </div>

        <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogContent
            showCloseButton={false}
            className="top-0 right-0 bottom-0 left-0 flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-zinc-950 p-0 text-white sm:max-w-none"
          >
            <DialogTitle className="sr-only">{document?.filename ?? "Document"}</DialogTitle>
            <DocumentViewer
              document={document}
              focusedSource={focusedSource}
              onClose={() => setSheetOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <DocumentLibrary activeId={id} />
      <DocumentViewer document={document} focusedSource={focusedSource} />
      <aside className="flex w-95 shrink-0 flex-col border-l border-white/10 bg-zinc-950">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <h2 className="text-sm font-semibold text-white">Conversation</h2>
          <button
            aria-label="New conversation"
            onClick={handleNewConversation}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Plus className="size-4" />
          </button>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <ChatWindow
            key={chatKey}
            documentId={id}
            documentFilename={document?.filename}
            initialSessionId={initialSessionId}
            onCiteClick={handleCiteClick}
            onSessionChange={setActiveSessionId}
          />
        </div>
      </aside>
    </div>
  );
}
