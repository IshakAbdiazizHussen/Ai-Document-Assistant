"use client";

import { Check, MessageSquare, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { useDocuments } from "@/hooks/use-documents";
import {
  useChatSessions,
  useDeleteChatSession,
  useUpdateChatSession,
} from "@/hooks/use-chat";
import type { ChatSessionSummary } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

function dayBucket(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfWeek) return "Previous 7 days";
  return "Older";
}

export default function ConversationsPage() {
  const { data: sessions, isPending, isError, refetch } = useChatSessions();
  const { data: documents } = useDocuments();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    if (!sessions) return [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? sessions.filter((s) =>
          (s.title ?? s.last_message_preview ?? "").toLowerCase().includes(query),
        )
      : sessions;

    const pinned = filtered.filter((s) => s.pinned);
    const rest = filtered.filter((s) => !s.pinned);

    const buckets = new Map<string, ChatSessionSummary[]>();
    if (pinned.length > 0) buckets.set("Pinned", pinned);
    for (const session of rest) {
      const key = dayBucket(session.updated_at);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(session);
    }

    const order = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Older"];
    return order
      .filter((key) => buckets.has(key))
      .map((key) => ({ label: key, sessions: buckets.get(key)! }));
  }, [sessions, search]);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Conversations"
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-40 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-violet-500/60 sm:w-64"
              />
            </div>
            <NewConversationMenu documents={documents} />
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {isPending ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg bg-white/5" />
            ))}
          </div>
        ) : isError ? (
          <div className="m-auto flex flex-col items-center gap-2 text-center">
            <p className="font-medium text-white">Couldn&rsquo;t load conversations</p>
            <p className="max-w-xs text-sm text-zinc-500">Something went wrong. Try again.</p>
            <button
              onClick={() => refetch()}
              className="text-sm font-medium text-violet-400 underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Open a document from the Documents tab and ask it a question to start one."
          />
        ) : groups.length === 0 ? (
          <p className="mt-12 text-center text-sm text-zinc-500">
            No conversations match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                {group.label}
              </h2>
              <div className="flex flex-col gap-2">
                {group.sessions.map((session) => (
                  <ConversationRow key={session.id} session={session} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NewConversationMenu({
  documents,
}: {
  documents: { id: string; filename: string }[] | undefined;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 min-[960px]:px-5">
        <Plus className="size-4" />
        <span className="hidden min-[960px]:inline">New conversation</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 border border-white/10 bg-zinc-900 text-zinc-200">
        {!documents || documents.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-zinc-500">Upload a document first.</p>
        ) : (
          documents.map((doc) => (
            <DropdownMenuItem
              key={doc.id}
              className="truncate focus:bg-white/10 focus:text-white"
              render={<Link href={`/dashboard/documents/${doc.id}?new=1`} />}
            >
              {doc.filename}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConversationRow({ session }: { session: ChatSessionSummary }) {
  const { mutate: update } = useUpdateChatSession();
  const { mutate: remove, isPending: isDeleting } = useDeleteChatSession();
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(session.title ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const title = session.title ?? session.last_message_preview ?? "Untitled conversation";
  const href = session.document_id
    ? `/dashboard/documents/${session.document_id}?session=${session.id}`
    : undefined;

  function submitRename() {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== session.title) {
      update({ sessionId: session.id, updates: { title: trimmed } });
    }
    setRenaming(false);
  }

  const primaryContent = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-950/60 text-violet-400">
        <MessageSquare className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="h-7 w-full rounded-md border border-white/20 bg-zinc-900 px-2 text-sm text-white outline-none focus:border-violet-500/60"
            />
            <button
              onClick={submitRename}
              aria-label="Save"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => setRenaming(false)}
              aria-label="Cancel"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            {session.document_filename ? (
              <span className="shrink-0 truncate rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-400">
                {session.document_filename}
              </span>
            ) : null}
          </div>
        )}
        {!renaming && session.last_message_preview ? (
          <p className="truncate text-sm text-zinc-500">{session.last_message_preview}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/2 px-4 py-3 transition-colors hover:bg-white/5">
        {href && !renaming ? (
          <Link href={href} className="flex min-w-0 flex-1">
            {primaryContent}
          </Link>
        ) : (
          primaryContent
        )}

        <div className="flex shrink-0 items-center gap-4 text-xs text-zinc-500">
          <span className="hidden min-[960px]:inline">{session.message_count} messages</span>
          <span className="hidden min-[960px]:inline">{formatRelativeTime(session.updated_at)}</span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Rename"
              onClick={() => {
                setDraftTitle(session.title ?? "");
                setRenaming(true);
              }}
              className="flex size-7 items-center justify-center rounded-md hover:bg-white/10 hover:text-white"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              aria-label={session.pinned ? "Unpin" : "Pin"}
              onClick={() => update({ sessionId: session.id, updates: { pinned: !session.pinned } })}
              className={cn(
                "flex size-7 items-center justify-center rounded-md hover:bg-white/10 hover:text-white",
                session.pinned && "text-violet-400",
              )}
            >
              <Pin className={cn("size-3.5", session.pinned && "fill-current")} />
            </button>
            <button
              aria-label="Delete"
              onClick={() => setConfirmOpen(true)}
              className="flex size-7 items-center justify-center rounded-md hover:bg-destructive/20 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{title}&rdquo; and all its messages. This can&rsquo;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={isDeleting}
              className="rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
              onClick={() => remove(session.id, { onSuccess: () => setConfirmOpen(false) })}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
