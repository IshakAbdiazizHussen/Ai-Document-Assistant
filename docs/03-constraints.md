# AI Document Assistant — Constraints Document

Status: Binding rules for this project. Any deviation must be explicitly approved before implementation.

---

## 1. Development Constraints

- Do not skip planning documents. The four project documents (Project Definition, Architecture, Constraints, Development Plan) must be reviewed before any code is written.
- Follow the development order defined in the Development Plan Document. Sections are sequential by design (e.g., document processing must exist before embeddings can be generated).
- Complete one section before moving to the next. Partial, half-working sections must not be carried forward.
- Test every completed section before advancing, using the testing approach defined for that section.
- Avoid introducing technologies not listed in the Project Definition and Architecture documents unless explicitly approved.
- Keep frontend and backend separated — the frontend must only communicate with the backend through its HTTP API, never by importing backend code or accessing the database/vector store directly.
- Do not begin frontend development before the backend's core RAG flow (upload → process → embed → retrieve → answer) is functional and testable.

## 2. Architecture Constraints

- Use only the selected technology stack: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query (frontend); Python, FastAPI, PostgreSQL, SQLAlchemy (backend); OpenAI API, OpenAI Embeddings, ChromaDB (AI layer).
- Maintain clean separation of responsibilities: API routes handle HTTP concerns only; business logic lives in the service layer; data access lives in the model/repository layer; AI calls are isolated in dedicated modules.
- Keep the MVP simple. Do not add billing or real-time collaboration unless explicitly scoped in. Password-based auth (register/login/logout/forgot-password) and per-user document/chat isolation were explicitly scoped in and are implemented (see `app/api/routes/auth.py`); true multi-tenancy beyond per-user ownership (teams, roles, shared workspaces) is still out of scope.
- Avoid over-engineering — do not introduce abstractions, design patterns, or infrastructure (e.g., message queues, microservices) that the current scope does not require.
- The relational database (PostgreSQL) is the source of truth for metadata; the vector database (ChromaDB) is a derived index that supports semantic search, not a source of truth for document content.

## 3. AI Constraints

- AI responses must rely on document context retrieved via RAG. The assistant must not answer from general model knowledge when the question concerns document content.
- If retrieved context does not contain a relevant answer, the assistant must say the information isn't available rather than fabricating a response.
- Protect OpenAI API keys at all times — they are loaded from environment variables on the backend only and must never be sent to, or accessible from, the frontend.
- Maintain RAG accuracy: retrieved chunks used to generate an answer must be the actual basis for that answer, and should be referenced/traceable in the response.
- Keep prompt construction (system instructions + retrieved context + user question) centralized in one module so grounding behavior stays consistent and auditable.

## 4. Code Quality Constraints

- Write maintainable code: small, single-purpose functions/modules, consistent naming, no duplicated logic across layers.
- Use proper structure: follow the folder/module responsibilities defined in the Architecture Document — do not mix concerns (e.g., no direct database queries inside API route handlers).
- Use environment variables for all configuration that differs between environments (API keys, database URL, model names, size limits) — no hardcoded values for these.
- Handle errors properly at every boundary (file upload, AI calls, database operations); failures must produce clear, sanitized error responses, never raw stack traces to the client.
- Avoid hardcoded values for anything environment-specific or subject to change (file size limits, chunk sizes, model names) — these belong in configuration, not inline in logic.

## 5. Security Constraints

**Secret Management**
- All secrets (OpenAI API key, database credentials) live in environment variables, loaded via a validated settings object.
- `.env` files are never committed to version control; only `.env.example` (with placeholder values) is tracked.

**File Validation**
- Only accept allow-listed file types (PDF, DOCX, TXT).
- Enforce a maximum upload size and reject oversized files with a clear error.
- Never trust client-supplied filenames for server-side file paths; generate storage paths/IDs server-side.

**User Data Protection**
- Document content and chat history are only accessible to the user/session that owns them.
- Deleting a document must remove its associated chunks and vector embeddings, not just the database record.

**API Security**
- The backend is the only component with access to the OpenAI API and the databases; the frontend never receives credentials for either.
- Input validation happens at the API boundary (via Pydantic schemas) before any data reaches business logic.
- Error responses returned to clients must not leak internal implementation details (stack traces, database errors, raw provider errors).
