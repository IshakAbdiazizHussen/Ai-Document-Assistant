# Backend — Remaining Features Execution Spec

Status: Execution layer underneath `docs/04-development-plan.md` Sections 3–10. Each feature below is self-contained: spec, ready-to-use AI-assistant prompt, guidelines/rules, security check, and QA checklist. Implement in order — each feature depends on the one before it.

**Before starting any feature**, read `docs/01-project-definition.md`, `docs/02-architecture.md`, `docs/03-constraints.md`, and `docs/04-development-plan.md` — in that order, in full — then this feature's entry below. This applies every time, even when moving from one feature straight to the next in the same session; do not rely on having read them for a previous feature. Nothing in this document overrides those four.

Backend Phase 1 (foundation) is already built: `backend/app/main.py` (FastAPI app + `/health`), `backend/app/core/config.py` (settings), `backend/app/core/logging.py`, and the full package skeleton (`api/routes`, `models`, `schemas`, `services`, `processing`, `ai`, `db`, `utils`, all currently empty `__init__.py` stubs). Every feature below fills in that skeleton.

---

## Feature 1 — Database Setup

### Spec
Define the relational schema and migration tooling all later features depend on.

**Tables** (SQLAlchemy models in `backend/app/models/`):

| Table | Columns | Relationships |
|---|---|---|
| `users` (`user.py`) | `id` UUID PK, `email` str unique, `created_at` | 1→N documents, 1→N chat_sessions |
| `documents` (`document.py`) | `id` UUID PK, `user_id` FK, `filename` str, `file_type` str, `file_size_bytes` int, `status` enum(`processing`/`ready`/`failed`), `error_message` str nullable, `storage_path` str, `created_at`, `updated_at` | 1→N chunks (cascade delete), 1→N chat_sessions |
| `chunks` (`chunk.py`) | `id` UUID PK, `document_id` FK cascade, `chunk_index` int, `text` text, `vector_id` str, `token_count` int, `created_at` | belongs to documents |
| `chat_sessions` (`chat_message.py` or a dedicated `chat_session.py`) | `id` UUID PK, `user_id` FK, `document_id` FK nullable, `created_at` | 1→N chat_messages (cascade delete) |
| `chat_messages` (`chat_message.py`) | `id` UUID PK, `session_id` FK cascade, `role` enum(`user`/`assistant`), `content` text, `source_chunk_ids` JSON nullable, `created_at` | belongs to chat_sessions |

**Acceptance criteria**: `alembic upgrade head` runs clean on an empty database; each model round-trips (create/read/delete); deleting a `documents` row cascades to `chunks`; deleting a `chat_sessions` row cascades to `chat_messages`.

### Prompt
```
You're working on the AI Document Assistant backend at
backend/ (FastAPI + SQLAlchemy + PostgreSQL).

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read this feature's entry in docs/05-backend-remaining-features.md
(Feature 1) in full before writing any code.

Backend foundation is already built: app/main.py, app/core/config.py
(has `database_url` in Settings, loaded from DATABASE_URL env var),
and empty package stubs under app/models/, app/db/, app/schemas/.

Implement Database Setup (docs/04-development-plan.md Section 3):
1. SQLAlchemy models in app/models/: User, Document, Chunk, ChatSession,
   ChatMessage — schema exactly as in docs/05-backend-remaining-features.md
   Feature 1 table above. Use UUID primary keys, cascade deletes where noted.
2. app/db/base.py — declarative Base, imports all models so Alembic can see them.
3. app/db/session.py — SQLAlchemy engine + SessionLocal using settings.database_url,
   plus a get_db() FastAPI dependency (yield session, close in finally).
4. Set up Alembic (alembic init, configure env.py to use app.db.base.Base.metadata
   and settings.database_url), generate and apply the initial migration.
5. Add a small pytest test (tests/test_db_models.py) that creates a User,
   Document, and Chunk, confirms the relationship, then deletes the Document
   and confirms its Chunk is gone (cascade).

Do not add any route or service logic yet — this feature is models +
migrations + one test only. Stop once `alembic upgrade head` and `pytest
tests/test_db_models.py` both pass against a local Postgres instance.
```

### Guidelines & Rules
- Match the schema exactly — later features assume these exact table/column names.
- PostgreSQL is the source of truth for all metadata; nothing here talks to ChromaDB or OpenAI (per `docs/03-constraints.md` Architecture Constraints).
- Use `get_db()` as a FastAPI dependency everywhere in later features — no route ever creates its own session.
- No hardcoded connection strings; only `settings.database_url`.

### Security Check
- [ ] `DATABASE_URL` is read only from environment/settings, never hardcoded.
- [ ] No credentials appear in Alembic config files committed to git.
- [ ] Cascade deletes are real (verified by test), so deleting a document can't orphan rows that leak content later.

### Quality Assurance
- [ ] `alembic upgrade head` succeeds on a fresh, empty database.
- [ ] `alembic downgrade base` then `upgrade head` again succeeds (migration is reversible).
- [ ] `pytest tests/test_db_models.py` passes, including the cascade-delete assertion.
- [ ] Creating a `Document` with an invalid `user_id` (no matching user) raises a foreign-key error, not a silent insert.

---

## Feature 2 — Document Upload System

### Spec
Accept a file upload, validate it, store it, and create a trackable `documents` row.

**Endpoints** (`app/api/routes/documents.py`): `POST /documents/upload`, `GET /documents`, `GET /documents/{id}`, `DELETE /documents/{id}` — request/response shapes exactly as in the original approved API design (upload returns `{id, filename, status: "processing", created_at}`; list/detail return the full row; delete returns `204`).

**Acceptance criteria**: valid PDF/DOCX/TXT uploads succeed and appear in `GET /documents`; invalid type → `400`; oversized file → `413`; delete removes the file from disk and the DB row.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 2 in full before
writing any code.

Already built: the DB layer (app/models/, app/db/session.py with get_db()),
app/core/config.py (has upload_dir and max_upload_size_bytes in Settings).

Implement the Document Upload System (docs/04-development-plan.md Section 4):
1. app/utils/file_validation.py — validate_upload(file) checking extension
   allowlist (.pdf, .docx, .txt) and size against settings.max_upload_size_bytes;
   raise a typed exception (not a bare Exception) the route layer can catch.
2. app/schemas/document.py — Pydantic schemas: DocumentCreateResponse,
   DocumentDetail, DocumentListItem.
3. app/services/document_service.py — save_upload(file, db) -> Document:
   validates, generates a server-side UUID filename (never trust the
   client's filename for the storage path), writes to settings.upload_dir,
   inserts a Document row with status="processing", returns it.
   Also list_documents(db), get_document(db, id), delete_document(db, id)
   (delete the file from disk AND the DB row — chunk/vector cleanup comes
   in later features, leave a TODO comment only if genuinely deferred).
4. app/api/routes/documents.py — wire up POST /documents/upload (multipart),
   GET /documents, GET /documents/{id}, DELETE /documents/{id}, using
   get_db() and document_service. Return 400 for invalid file, 413 for
   oversized, 404 for missing document.
5. Register the router in app/main.py.
6. Tests in tests/test_documents.py covering: valid upload, invalid
   extension, oversized file, list, get, delete.

Stop once all tests pass and manual testing via /docs (Swagger UI) confirms
upload → list → delete works end-to-end.
```

### Guidelines & Rules
- Never use the client-supplied filename as the on-disk path — generate a server-side identifier (per `docs/03-constraints.md` Security Constraints).
- Route handlers stay thin — validation and persistence logic lives in `document_service.py`, not in `app/api/routes/documents.py` (per Architecture Constraints).
- `settings.upload_dir` must be created if missing; never assume it exists.
- Do not implement extraction/chunking here — status stays `"processing"` until Feature 3 wires that in.

### Security Check
- [ ] File extension AND declared content-type are checked — not extension alone.
- [ ] Upload size is enforced server-side (not just relying on a frontend check).
- [ ] Storage path is server-generated (UUID-based), not derived from client input — no path traversal possible.
- [ ] Deleting a document actually removes the file from disk, not just the DB row.
- [ ] Errors returned to the client never include the server-side file path or stack trace.

### Quality Assurance
- [ ] Upload a real PDF, DOCX, and TXT — all three succeed with `201` and `status: "processing"`.
- [ ] Upload a `.exe` or `.png` — rejected with `400`, clear message.
- [ ] Upload a file larger than `max_upload_size_bytes` — rejected with `413`.
- [ ] `GET /documents` reflects all uploaded files; `GET /documents/{id}` 404s for an unknown ID.
- [ ] `DELETE /documents/{id}` removes both the DB row and the on-disk file (verify the file is gone).

---

## Feature 3 — Document Extraction & Processing

### Spec
Convert the stored raw file into clean text, split into chunks, and persist chunk rows; update document status to `ready`/`failed`.

**Acceptance criteria**: for each supported format, extraction produces readable text; chunker produces multiple reasonably-sized chunks for a multi-page document; a corrupted/unreadable file results in `status="failed"` with a stored `error_message`, not a crash.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 3 in full before
writing any code.

Already built: Document Upload System (Feature 2) — uploaded files are
saved to disk with a Document row at status="processing". app/models/chunk.py
already defines the Chunk table (id, document_id, chunk_index, text,
vector_id nullable, token_count, created_at).

Implement Document Extraction & Processing (docs/04-development-plan.md
Section 5):
1. app/processing/extractor.py — extract_text(file_path, file_type) -> str,
   one function per format: PDF (pypdf), DOCX (python-docx), TXT (plain read).
   Raise a typed ExtractionError on failure — don't let format-library
   exceptions bubble up raw.
2. app/processing/cleaner.py — clean_text(raw_text) -> str: normalize
   whitespace, strip control characters, collapse repeated blank lines.
3. app/processing/chunker.py — chunk_text(text, chunk_size_tokens,
   overlap_tokens) -> list[str], using settings.chunk_size_tokens /
   settings.chunk_overlap_tokens as defaults (already in app/core/config.py).
4. Extend app/services/document_service.py with process_document(db, document_id):
   runs extract → clean → chunk, inserts one Chunk row per chunk (vector_id
   left null — Feature 5 fills it in), sets document.status = "ready" on
   success or "failed" + document.error_message on any exception in this
   pipeline (catch broadly here specifically, since this is the recovery
   boundary — nowhere else in the codebase should swallow exceptions this
   broadly).
5. Call process_document() from the upload route in app/api/routes/documents.py
   right after the upload response is prepared (synchronous call is fine for
   this feature — a FastAPI BackgroundTasks call is a reasonable non-blocking
   improvement but not required to pass this feature's QA).
6. Tests in tests/test_processing.py: one fixture file per format under
   tests/fixtures/, assert extracted text is non-empty and readable, assert
   chunk count/size is reasonable for a multi-page fixture, assert an
   unsupported/corrupted file results in status="failed" not an exception
   escaping the route.

Stop once tests pass and a real multi-page PDF uploaded via /docs transitions
from "processing" to "ready" with multiple Chunk rows in the database.
```

### Guidelines & Rules
- Each pipeline stage (`extractor`, `cleaner`, `chunker`) is independently callable and testable without a live upload or database — no stage should require the others to run.
- Processing failures must never crash the request or leave a document stuck at `"processing"` forever — always resolve to `ready` or `failed`.
- Do not call OpenAI or ChromaDB here — that's Features 4 and 5. This feature only produces `Chunk.text` rows.

### Security Check
- [ ] Malformed/corrupted files are handled without leaking library stack traces to the API response.
- [ ] Extraction never executes or evaluates file content (e.g., no macro execution on DOCX) — text extraction only.
- [ ] Very large documents don't cause unbounded memory growth (stream/parse incrementally where the library supports it, or note the limitation).

### Quality Assurance
- [ ] Multi-page PDF fixture → status becomes `"ready"`, chunk count > 1.
- [ ] DOCX fixture → text is extracted correctly (spot-check content matches source).
- [ ] Plain TXT fixture → chunked correctly with expected overlap behavior.
- [ ] A deliberately corrupted PDF (truncated bytes) → status becomes `"failed"` with a populated `error_message`, and the API request that triggered it still returns cleanly (no 500).
- [ ] Chunk sizes stay within `chunk_size_tokens` bounds (±overlap) for a large fixture.

---

## Feature 4 — Embedding Generation

### Spec
Convert chunk text into OpenAI embedding vectors, batched per document.

**Acceptance criteria**: given a list of chunk texts, returns one vector per chunk in the same order; API failures are caught and don't crash the processing pipeline; no API key ever appears in logs.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 4 in full before
writing any code.

Already built: Document Extraction & Processing (Feature 3) — Chunk rows
exist with `text` populated. app/core/config.py already has
openai_api_key and openai_embedding_model in Settings.

Implement Embedding Generation (docs/04-development-plan.md Section 6):
1. app/ai/embeddings.py — embed_texts(texts: list[str]) -> list[list[float]],
   using the official `openai` Python SDK client, settings.openai_embedding_model,
   batching multiple chunks per API call where the SDK supports it. Wrap
   API/network errors in a typed EmbeddingError — never let a raw OpenAI
   SDK exception or the API key surface in an error message or log line.
2. Add basic retry (e.g., 2 retries with backoff) for transient failures
   (timeouts, 429s) — not for validation errors like an invalid key.
3. Do NOT wire this into document_service.py yet in a way that blocks
   Feature 3's tests — add a thin integration point (e.g., a call inside
   process_document() after chunking, storing embeddings in-memory for
   now) that Feature 5 will complete by persisting into the vector store.
4. Tests in tests/test_embeddings.py: mock the OpenAI client (do not make
   real API calls in the default test run), verify embed_texts returns
   correctly-shaped output, verify an API error is wrapped as EmbeddingError
   and doesn't crash, verify no API key string ever appears in a raised
   exception's message.

Stop once mocked tests pass. A live-key smoke test (skippable/marked) that
actually calls OpenAI is a nice-to-have, not required to pass this feature.
```

### Guidelines & Rules
- `app/ai/embeddings.py` is the only module that imports the OpenAI SDK for embeddings — nothing else calls OpenAI directly for this purpose.
- Batch requests rather than one API call per chunk, per `docs/03-constraints.md` cost/simplicity expectations.
- Centralize the OpenAI client construction in one place (reads `settings.openai_api_key` once), not re-instantiated ad hoc.

### Security Check
- [ ] `OPENAI_API_KEY` is read only via `settings.openai_api_key` — never logged, never included in an exception message or API response.
- [ ] The app still boots with a placeholder API key; failures only occur when embeddings are actually requested (no startup-time validation that would leak key format issues).
- [ ] Retries don't retry on auth errors (would just waste calls / risk logging the failure repeatedly).
- [ ] Confirm by grepping test output and logs after a forced failure that the key value never appears anywhere in captured output.

### Quality Assurance
- [ ] `embed_texts(["a", "b", "c"])` (mocked) returns 3 vectors in the same order as input.
- [ ] A simulated network timeout is retried, then eventually raises `EmbeddingError` cleanly if retries are exhausted.
- [ ] A simulated 401 (invalid key) raises immediately without retrying.
- [ ] No test in the default `pytest` run makes a real network call to OpenAI.

---

## Feature 5 — Vector Database Integration

### Spec
Persist chunk embeddings in ChromaDB and support similarity search, replacing the in-memory stand-in from Feature 4.

**Acceptance criteria**: chunks are stored with `document_id`/`chunk_index` metadata; similarity search returns relevant chunks for a matching query; deleting a document removes its vectors; `Chunk.vector_id` is populated for every stored chunk.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 5 in full before
writing any code.

Already built: Embedding Generation (Feature 4) — app/ai/embeddings.py
produces vectors. app/core/config.py has chroma_persist_dir in Settings.
Chunk rows exist with vector_id currently null.

Implement Vector Database Integration (docs/04-development-plan.md Section 7):
1. app/ai/vector_store.py — a thin wrapper around the `chromadb` client:
   add_chunks(document_id, chunk_records) (each record: chunk_id, text,
   embedding), query(embedding, top_k, document_id=None) -> list of
   {chunk_id, document_id, text, score}, delete_document(document_id).
   Use settings.chroma_persist_dir for a persistent local client. This is
   the ONLY module that imports chromadb directly.
2. Update app/services/document_service.py's process_document(): after
   chunking + embedding, call vector_store.add_chunks(...), then set each
   Chunk.vector_id to the returned vector store ID and commit.
3. Update delete_document() in document_service.py to call
   vector_store.delete_document(document_id) before/alongside deleting the
   DB rows and the file.
4. Tests in tests/test_vector_store.py: store a few known chunks with
   distinct content, run a similarity query for a related phrase and
   assert the expected chunk ranks near the top; assert filtering by
   document_id excludes other documents' chunks; assert delete_document
   removes them from subsequent queries. Use a temp directory for
   chroma_persist_dir in tests so runs don't pollute real storage.

Stop once tests pass and a real document uploaded end-to-end (upload →
process → embed → store) is confirmed searchable via a direct call to
vector_store.query() in a scratch script or test.
```

### Guidelines & Rules
- `app/ai/vector_store.py` is the sole ChromaDB access point — no other module imports `chromadb`.
- PostgreSQL (`Chunk.text`) stays the source of truth; ChromaDB is a derived index that could theoretically be rebuilt from it (per `docs/01-project-definition.md`).
- Deleting a document must be verified to actually remove its vectors, not just detach them — check with a follow-up query in tests, not just "no error thrown."

### Security Check
- [ ] `chroma_persist_dir` is excluded from version control (already covered by `backend/.gitignore`, confirm it stays that way).
- [ ] No document's chunks are ever returned in a similarity search scoped to a different `document_id`.
- [ ] Deleting a document leaves zero residual vectors (verified by test, not assumption).

### Quality Assurance
- [ ] Store 3 chunks with clearly distinct topics; a query matching one topic ranks that chunk highest.
- [ ] `document_id`-filtered query never returns another document's chunks.
- [ ] After `delete_document(id)`, a query that previously matched that document's chunks now returns none of them.
- [ ] Repeated upload/delete cycles leave no orphaned vectors (spot-check total vector count matches expected).

---

## Feature 6 — RAG Question-Answering System

### Spec
Given a question, retrieve relevant chunks and generate a grounded answer via OpenAI chat completion.

**Acceptance criteria**: a question with a clear answer in a test document returns an accurate, source-referenced answer; an out-of-scope question is correctly declined rather than hallucinated; retrieval scoped to one document never leaks another document's content.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md (pay close attention to the RAG Workflow section)
2. docs/02-architecture.md
3. docs/03-constraints.md (pay close attention to the AI Constraints section)
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 6 in full before
writing any code.

Already built: Vector Database Integration (Feature 5) — vector_store.query()
works. app/ai/embeddings.py can embed a query string the same way it embeds
chunks. app/core/config.py has openai_chat_model and retrieval_top_k.

Implement the RAG Question-Answering System (docs/04-development-plan.md
Section 8):
1. app/ai/llm.py — build_grounded_prompt(question, retrieved_chunks) ->
   list of chat messages: a system message instructing the model to answer
   ONLY from the provided context and to explicitly say the information
   isn't available if the context doesn't contain an answer, then the
   retrieved chunk texts as context, then the user's question.
   generate_answer(question, retrieved_chunks) -> str, calling the OpenAI
   chat completions API with settings.openai_chat_model and the prompt
   from build_grounded_prompt. Wrap API errors the same way Feature 4 does
   (typed error, no key leakage).
2. app/services/chat_service.py — answer_question(db, question, document_id=None,
   top_k=settings.retrieval_top_k) -> {answer, sources}: embeds the question
   (reuse app/ai/embeddings.py), calls vector_store.query(embedding, top_k,
   document_id), calls llm.generate_answer(question, retrieved_chunks),
   returns the answer plus a sources list (chunk_id, document_id, excerpt)
   built from the retrieved chunks actually used.
3. This feature does NOT need a route yet (Feature 7 exposes it via
   POST /chat) — expose it as a plain function so it's directly testable.
4. Tests in tests/test_rag.py: seed a test document's chunks + vectors
   with known content, ask a question whose answer is clearly present,
   assert the response mentions the right content and cites the right
   chunk; ask an unrelated question, assert the response indicates the
   information isn't available (don't hard-match exact wording — assert
   it does NOT fabricate specific facts not in the seeded content); ask a
   document-scoped question against a document_id that has no matching
   content and confirm no cross-document leakage in the returned sources.

Stop once tests pass. Mock the OpenAI chat completion call in the default
test run; a live-key smoke test is optional.
```

### Guidelines & Rules
- Prompt construction lives in exactly one place (`app/ai/llm.py`) — no other module builds a chat prompt, so grounding behavior stays consistent and auditable (per `docs/03-constraints.md`).
- The model must never be instructed to use outside knowledge for document questions — the system prompt is the single point of control for this rule.
- `sources` returned must correspond to chunks actually passed to the model — never fabricate or backfill a source after the fact.

### Security Check
- [ ] The system prompt cannot be overridden by user input (question text is inserted as a separate message, not concatenated into the system instructions).
- [ ] Retrieved context is scoped correctly — a `document_id`-scoped question never receives another document's chunks as context.
- [ ] OpenAI API errors during generation don't leak internal details in the returned error.

### Quality Assurance
- [ ] Known-answer question against seeded content → correct, source-cited answer.
- [ ] Out-of-scope question → response clearly indicates the information isn't available, no fabricated specifics.
- [ ] Document-scoped question with `document_id` set → sources only ever reference that document.
- [ ] Empty/near-empty retrieval (no relevant chunks found) is handled gracefully, not as a crash.

---

## Feature 7 — Chat API Development

### Spec
Expose the RAG pipeline over HTTP and persist conversation history.

**Endpoints**: `POST /chat`, `GET /chat/{session_id}/messages` — shapes as originally specified (request `{session_id?, document_id?, message}`; response `{answer, sources, session_id}`).

**Acceptance criteria**: a sequence of messages in the same session persists and returns in order; a new session is created when none is given; source references in each assistant message correspond to real chunks.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 7 in full before
writing any code.

Already built: RAG Question-Answering System (Feature 6) — chat_service
.answer_question() works as a plain function. app/models/chat_message.py
(or chat_session.py) already defines ChatSession and ChatMessage tables
from Feature 1.

Implement Chat API Development (docs/04-development-plan.md Section 9):
1. app/schemas/chat.py — Pydantic schemas: ChatRequest (message, session_id
   optional, document_id optional), ChatResponse (answer, sources, session_id),
   ChatMessageOut.
2. Extend app/services/chat_service.py: send_message(db, message, session_id,
   document_id) -> ChatResponse: if session_id is None, create a new
   ChatSession; persist the user's ChatMessage; call answer_question();
   persist the assistant's ChatMessage with source_chunk_ids; return the
   response. Also get_session_messages(db, session_id) -> ordered list.
3. app/api/routes/chat.py — POST /chat and GET /chat/{session_id}/messages,
   using get_db() and chat_service. Any exception from the RAG pipeline
   (Feature 6) must still result in a clean, sanitized error response —
   never a 500 with a raw stack trace, and the session should remain
   usable afterward (don't leave it in a half-written state).
4. Register the router in app/main.py.
5. Tests in tests/test_chat.py: send multiple messages in one session,
   confirm history order via GET; send with no session_id twice, confirm
   two different sessions are created; force the RAG pipeline to raise
   (mock it) and confirm the endpoint still returns a clean error response,
   not a 500 with internals exposed.

Stop once tests pass and a full upload → process → chat round trip works
via /docs (Swagger UI) against a real (or mocked, if no key is configured)
OpenAI call.
```

### Guidelines & Rules
- `app/api/routes/chat.py` contains no business logic — everything routes through `chat_service`, matching the "routes handle HTTP only" rule in `docs/03-constraints.md`.
- Concurrent requests to different sessions must not interfere with each other (no shared mutable state outside the DB).
- Request/response validation happens via Pydantic schemas at the boundary, before any data reaches `chat_service`.

### Security Check
- [ ] A `session_id` only ever returns/accepts messages belonging to that session (no cross-session leakage once the app has a real user/auth boundary — for MVP, at minimum verify the session_id → messages mapping is exact).
- [ ] Errors from the RAG pipeline are sanitized before reaching the client (no raw OpenAI/DB error text).
- [ ] Chat input is validated (non-empty, reasonable max length) before being embedded/sent to OpenAI, to avoid wasted/abusive API calls.

### Quality Assurance
- [ ] Multi-turn conversation in one session persists and replays correctly in order.
- [ ] Omitting `session_id` creates a new session each time; providing one reuses it.
- [ ] `sources` in each assistant message correspond to real, existing chunks (spot-check IDs against the `chunks` table).
- [ ] A forced pipeline failure returns a clean 5xx/4xx with a generic message, not a stack trace, and the app keeps running afterward.

---

## Feature 8 — Backend Testing & Stabilization

### Spec
Harden the whole backend before frontend integration: full automated suite, error-handling review, config/secrets review.

**Acceptance criteria**: `pytest` passes end-to-end including one full upload→chat integration test; no hardcoded secrets or config values remain anywhere in `backend/`; no endpoint leaks internal error details.

### Prompt
```
You're working on the AI Document Assistant backend at backend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/05-backend-remaining-features.md Feature 8 in full before
writing any code.

Already built: Features 1–7 (DB, upload, processing, embeddings, vector
store, RAG, chat API) — the full backend feature set exists with per-feature
tests.

Implement Backend Testing & Stabilization (docs/04-development-plan.md
Section 10):
1. Add tests/test_integration.py: one end-to-end test that uploads a real
   fixture file, waits for/triggers processing, then sends a chat question
   and asserts a correct, source-cited answer — exercising the full stack
   through the FastAPI TestClient, with OpenAI calls mocked so the suite
   doesn't require a live key by default.
2. Review every route in app/api/routes/ for exception handling: add a
   shared exception handler in app/main.py (or per-router) so unhandled
   exceptions become a sanitized 500 response, never a raw traceback, while
   still logging the full detail server-side via app/core/logging.py.
3. Grep the entire backend/ tree for hardcoded values that should be
   config (API keys, file paths, size limits, model names) and move any
   found into app/core/config.py / .env.example.
4. Confirm .env is gitignored and .env.example has no real secret values.
5. Run the full pytest suite and fix anything broken by the review pass.

Stop once `pytest` passes clean from a fresh virtualenv install
(pip install -r requirements.txt && pytest), with zero tests requiring a
real OpenAI key by default.
```

### Guidelines & Rules
- This feature adds no new user-facing functionality — it's verification and hardening only, per the phase discipline in `docs/04-development-plan.md`.
- Any bug found here gets fixed in the feature/file it belongs to, not patched around in the test.
- Tests must be deterministic — no flaky dependence on real network calls in the default suite.

### Security Check
- [ ] Full-repo grep for `sk-`, `OPENAI_API_KEY=`, or similar confirms no real key is committed anywhere (including test fixtures/history).
- [ ] Every route's error responses were manually triggered at least once (bad input, forced exception) and confirmed sanitized.
- [ ] `.env` is not tracked by git (`git status` / `git check-ignore` confirms it).

### Quality Assurance
- [ ] `pytest` passes fully from a clean `pip install -r requirements.txt`.
- [ ] The end-to-end integration test (upload → process → chat) passes.
- [ ] No test leaves residual files in `storage/` or stale rows in the test database after a run.
- [ ] Manually triggering an unsupported file type, an oversized file, and a malformed chat request all produce clean, correctly-coded error responses (400/413/422), verified via `/docs`.

---

## Next Step

Once these 8 backend features are implemented and each Quality Assurance checklist passes, continue with `docs/06-frontend-remaining-features.md` Feature 10 (API Integration), which depends on Features 2–7 being live.
