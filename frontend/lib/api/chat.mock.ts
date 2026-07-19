import type { ChatMessage, ChatResponse, ChatSource } from "@/lib/types/chat";

/**
 * In-memory (localStorage-backed) stand-in for the real /chat API (see
 * docs/05-backend-remaining-features.md Feature 7). Replaced by
 * lib/api/chat.ts (Axios) in Phase 6 once the backend's chat endpoints are
 * wired up — hooks/use-chat.ts is the only caller, so the swap is a
 * one-file change.
 *
 * Persisted to localStorage (not just an in-memory variable) so chat
 * history survives a page reload within the same session, per this
 * feature's acceptance criteria.
 *
 * Note: unlike the real backend (which only stores source_chunk_ids on a
 * ChatMessage, not full excerpt text), this mock also persists a
 * chunk_id -> ChatSource lookup so historical messages can still render
 * full source references after a reload. Feature 10 will need to decide
 * how to handle that gap against the real, leaner contract.
 */

const MESSAGES_KEY = "ai-doc-assistant:chat-mock-messages";
const SOURCES_KEY = "ai-doc-assistant:chat-mock-sources";

type SessionMessages = Record<string, ChatMessage[]>;
type SourceLookup = Record<string, ChatSource>;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFakeSources(message: string, documentId: string | undefined): ChatSource[] {
  const docId = documentId ?? "mock-document";
  const snippet = message.trim().slice(0, 60) || "the uploaded document";
  return [
    {
      document_id: docId,
      chunk_id: crypto.randomUUID(),
      excerpt: `"...relevant passage discussing ${snippet}..."`,
    },
    {
      document_id: docId,
      chunk_id: crypto.randomUUID(),
      excerpt: `"...a second supporting excerpt on the same topic..."`,
    },
  ];
}

export async function sendMessage(
  sessionId: string | undefined,
  documentId: string | undefined,
  message: string,
): Promise<ChatResponse> {
  await delay(800);

  const allMessages = readJSON<SessionMessages>(MESSAGES_KEY, {});
  const allSources = readJSON<SourceLookup>(SOURCES_KEY, {});

  const id = sessionId ?? crypto.randomUUID();
  const history = allMessages[id] ?? [];

  const sources = buildFakeSources(message, documentId);
  for (const source of sources) {
    allSources[source.chunk_id] = source;
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    session_id: id,
    role: "user",
    content: message,
    created_at: new Date().toISOString(),
  };

  const answer = `Based on the document, here's what I found regarding "${message
    .trim()
    .slice(0, 80)}": this is a simulated grounded answer referencing the source passages below.`;

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    session_id: id,
    role: "assistant",
    content: answer,
    source_chunk_ids: sources.map((source) => source.chunk_id),
    created_at: new Date().toISOString(),
  };

  allMessages[id] = [...history, userMessage, assistantMessage];
  writeJSON(MESSAGES_KEY, allMessages);
  writeJSON(SOURCES_KEY, allSources);

  return { answer, sources, session_id: id };
}

export async function getSessionMessages(
  sessionId: string | undefined,
): Promise<ChatMessage[]> {
  await delay(200);
  if (!sessionId) return [];
  const allMessages = readJSON<SessionMessages>(MESSAGES_KEY, {});
  return allMessages[sessionId] ?? [];
}

export async function getSourceDetails(chunkIds: string[]): Promise<ChatSource[]> {
  if (chunkIds.length === 0) return [];
  const allSources = readJSON<SourceLookup>(SOURCES_KEY, {});
  return chunkIds
    .map((id) => allSources[id])
    .filter((source): source is ChatSource => Boolean(source));
}
