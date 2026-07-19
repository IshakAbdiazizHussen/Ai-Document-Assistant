# AI Document Assistant — Architecture Document

Status: Source of truth for technology architecture only. This document does not define development steps or timelines — see the Development Plan Document for that.

---

## 1. Frontend Architecture

**Technologies covered:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, API communication.

**Next.js 15**
Role: Application shell and routing. Owns page structure (document library view, chat view), server-side rendering where useful (e.g., initial document list), and client-side interactivity for the chat experience.
Connection: Renders the UI that calls the backend API; hosts the React component tree that shadcn/ui components and TanStack Query hooks plug into.

**TypeScript**
Role: Type safety across components, API client functions, and data models. Defines shared types for API request/response shapes (documents, chat messages, upload status).
Connection: Wraps every layer of the frontend — component props, API client return types, and TanStack Query hook generics all use the same TypeScript types, keeping the UI and API contract in sync.

**Tailwind CSS**
Role: Styling system for layout, spacing, color, and responsiveness across all pages and components.
Connection: Used directly inside Next.js components and as the styling foundation underneath shadcn/ui components.

**shadcn/ui**
Role: Supplies the concrete UI building blocks — upload dropzone, document list items, chat bubbles, input fields, buttons, dialogs, status badges.
Connection: Components are composed inside Next.js pages, styled via Tailwind, and driven by data/state coming from TanStack Query hooks.

**TanStack Query**
Role: Manages all server-state on the client — fetching the document list, polling document processing status, sending chat messages, and loading chat history. Handles caching, loading states, error states, and refetching (e.g., polling a document's status until it's "ready").
Connection: Sits between the UI components and the backend API client; every network call to FastAPI is wrapped in a TanStack Query hook (`useQuery`/`useMutation`).

**API Communication**
The frontend communicates with the backend exclusively over HTTP(S) using JSON payloads (and `multipart/form-data` for file uploads), against the FastAPI endpoints defined in the backend. No direct database or AI provider access happens from the frontend — all of that is mediated by the backend API. The backend's base URL is configured via a frontend environment variable, never hardcoded.

---

## 2. Backend Architecture

**Technologies covered:** Python, FastAPI, PostgreSQL, SQLAlchemy, OpenAI API, Embeddings, Vector database, Document processing.

**Python**
Role: Implementation language for the entire backend service.
Connection: Every backend component below is a Python module within the FastAPI application.

**FastAPI**
Role: HTTP API layer. Defines routes (document upload/list/delete, chat), validates incoming requests, and returns structured JSON responses. Handles async execution so I/O-bound work (database queries, OpenAI calls) doesn't block the server.
Connection: Sits at the top of the backend stack — receives requests from the frontend and delegates to the service layer, which in turn talks to PostgreSQL (via SQLAlchemy), the vector database, and the OpenAI API.

**PostgreSQL**
Role: Relational data store for structured, persistent data — documents, chunk metadata, chat sessions, chat messages.
Connection: Accessed exclusively through SQLAlchemy; never queried directly from route handlers.

**SQLAlchemy**
Role: ORM layer mapping Python model classes to PostgreSQL tables, and providing the query interface used by the service layer. Also underlies schema migrations (Alembic).
Connection: Sits between FastAPI's service layer and PostgreSQL — all reads/writes to relational data pass through it.

**OpenAI API**
Role: Generates the final natural-language answer during a chat interaction, using the retrieved document context.
Connection: Called by the backend's chat service after retrieval has produced relevant chunks; the API key is held server-side only and is never exposed to the frontend.

**Embeddings (OpenAI Embeddings API)**
Role: Converts document chunk text and user questions into numerical vectors for semantic comparison.
Connection: Called during document processing (to embed each chunk once, at upload time) and during chat (to embed the user's question, at query time).

**Vector Database (ChromaDB)**
Role: Stores chunk embeddings and performs similarity search to find the chunks most relevant to a given question.
Connection: Written to during document processing (after embeddings are generated) and read from during chat (to retrieve relevant chunks before calling the OpenAI API). Chunk text itself is also persisted in PostgreSQL, so the vector store is a derived index rather than the sole source of truth.

**Document Processing**
Role: Converts raw uploaded files (PDF, DOCX, TXT) into clean text, then splits that text into chunks appropriately sized for embedding and retrieval.
Connection: Runs immediately after a successful upload, before embeddings are generated; its output (chunk text) feeds both PostgreSQL (chunk records) and the embeddings step.

---

## 3. System Flow

```
Frontend (Next.js)
        │  HTTP requests (JSON / multipart)
        ▼
FastAPI Backend
        │
        ▼
Database (PostgreSQL via SQLAlchemy)
   — stores document, chunk, and chat metadata
        │
        ▼
Document Processing
   — extraction, cleaning, chunking (runs on upload)
        │
        ▼
Vector Search (ChromaDB + OpenAI Embeddings)
   — chunk embeddings stored on upload; query embeddings compared on chat
        │
        ▼
OpenAI (Chat Completion)
   — generates the answer using retrieved chunks as grounding context
        │
        ▼
Response
   — returned through FastAPI to the frontend, rendered in the chat UI
```

The frontend never talks to PostgreSQL, ChromaDB, or the OpenAI API directly — all of it is mediated by the FastAPI backend, which is the single point of access to data and AI services. This keeps secrets server-side and keeps the system flow linear and auditable: every answer can be traced back to the documents and chunks that produced it.
