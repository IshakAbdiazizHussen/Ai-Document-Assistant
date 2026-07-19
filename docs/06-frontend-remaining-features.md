# Frontend — Remaining Features Execution Spec

Status: Execution layer underneath the approved frontend development plan, Phases 5–8. Each feature below is self-contained: spec, ready-to-use AI-assistant prompt, guidelines/rules, security check, and QA checklist. Implement in order.

**Before starting any feature**, read `docs/01-project-definition.md`, `docs/02-architecture.md`, `docs/03-constraints.md`, and `docs/04-development-plan.md` — in that order, in full — then this feature's entry below. This applies every time, even when moving from one feature straight to the next in the same session; do not rely on having read them for a previous feature. Nothing in this document overrides those four.

Frontend Phases 1–4 are already built and verified in-browser: Next.js 15 + TypeScript + Tailwind + shadcn/ui + TanStack Query setup, root layout with Query/Theme/Toast providers, `Navbar`/`AppShell`, all routes (`/`, `/dashboard`, `/dashboard/documents/[id]`, `/settings`, 404), and the full Document Upload & List feature (`FileUpload`, `DocumentCard`, `DocumentList`, `DocumentStatusBadge`, delete confirmation) wired to `hooks/use-documents.ts`, which currently calls an in-memory mock at `lib/api/documents.mock.ts` (same shape as the real backend contract in `docs/01-project-definition.md` / `docs/05-backend-remaining-features.md`).

---

## Feature 9 — Chat Interface

### Spec
Build the chat UI (message list, input, source references) against the same kind of mock-first approach used for document upload, so it doesn't block on the backend's Chat API (Feature 7) being live yet.

**Acceptance criteria**: sending a message shows a "thinking" state, then renders the assistant's reply with source references; empty state shows when no document is selected; chat history persists across a page reload within the same session (mock-backed for now).

### Prompt
```
You're working on the AI Document Assistant frontend at frontend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read the approved frontend plan's Section 5 (Component Architecture),
Section 6 (API Integration Plan), and Section 7 (State Management) — ask
the user for the frontend plan file if not already in context. Then read
docs/06-frontend-remaining-features.md Feature 9 in full before writing
any code.

Already built: Document Upload & List (frontend Phase 4) — see
components/documents/, hooks/use-documents.ts, and lib/api/documents.mock.ts
for the established pattern: a mock data module with the same shape as the
real API, consumed by a TanStack Query hook, with toast notifications on
mutations. Follow this exact same pattern for chat.

Implement the Chat Interface (frontend plan Phase 5):
1. lib/types/chat.ts — ChatMessage {id, session_id, role: "user"|"assistant",
   content, source_chunk_ids?: string[], created_at}, ChatResponse
   {answer, sources: {document_id, chunk_id, excerpt}[], session_id}.
2. lib/api/chat.mock.ts — mirroring documents.mock.ts's pattern: an
   in-memory sendMessage(sessionId, documentId, message) -> ChatResponse
   (simulate ~800ms latency, return a canned/templated answer referencing
   the message text, with 1-2 fake source excerpts), and
   getSessionMessages(sessionId) -> ChatMessage[].
3. hooks/use-chat.ts — useChatMessages(sessionId) (TanStack useQuery) and
   useSendMessage() (useMutation, invalidates the messages query on
   success, shows a toast on error — same conventions as
   hooks/use-documents.ts).
4. components/chat/message-bubble.tsx — renders one ChatMessage,
   right-aligned for "user", left-aligned for "assistant", with a
   SourceReference list under assistant messages.
5. components/chat/source-reference.tsx — small expandable chip showing
   an excerpt + which document it came from.
6. components/chat/chat-input.tsx — text input + send button (React Hook
   Form + Zod: message required, reasonable max length), disabled while a
   send is pending.
7. components/chat/chat-window.tsx — composes message list (scrollable,
   auto-scrolls to latest) + ChatInput; owns its own loading (skeleton),
   empty ("select or upload a document to start chatting"), and
   thinking-indicator states.
8. Wire ChatWindow into app/dashboard/page.tsx and
   app/dashboard/documents/[id]/page.tsx, replacing the current
   placeholder Chat Card content — active document id (if any) is passed
   in as the document_id for scoping.

Verify in the browser (per the frontend plan's Testing Strategy Phase 5):
send a message, confirm the thinking indicator appears, then the reply
renders with source references, then reload the page and confirm history
persists (within the mock session).
```

### Guidelines & Rules
- Follow the exact mock-then-real pattern already established by `lib/api/documents.mock.ts` / `hooks/use-documents.ts` — don't invent a different pattern for chat.
- All server-state (messages, sending) goes through TanStack Query, per the frontend plan's State Management section — no message list duplicated into local `useState`.
- `ChatInput` must disable itself while a response is pending — never allow two in-flight sends for the same session.
- No component calls the mock/API functions directly — only through `hooks/use-chat.ts`, consistent with the documents feature.

### Security Check
- [ ] No API keys or backend internals are ever referenced from frontend code (chat mock included) — the mock module lives entirely client-side with no secrets.
- [ ] User-typed message content is rendered as text, not raw HTML (no `dangerouslySetInnerHTML`), to avoid any XSS surface once real backend content flows through.
- [ ] Message length is capped client-side (Zod schema) to avoid pathological payloads once wired to a real API in Feature 10.

### Quality Assurance
- [ ] Sending a message shows the thinking indicator, then the reply, with `ChatInput` disabled throughout and re-enabled after.
- [ ] Assistant messages show source references; clicking/expanding one reveals the excerpt.
- [ ] No document selected → chat panel shows the empty-state prompt, not a broken/blank chat window.
- [ ] Rapid repeated sends are prevented while a send is pending (button/input disabled, no double-submit).
- [ ] `npx tsc --noEmit` and `npm run lint` both pass; no console errors in the browser during the full send/receive flow (verify via a headless browser check, e.g. Playwright, as done for Phases 1–4).

---

## Feature 10 — API Integration

### Spec
Replace `lib/api/documents.mock.ts` and `lib/api/chat.mock.ts` with real Axios calls to the FastAPI backend, per the contract in `docs/01-project-definition.md` and now implemented in `docs/05-backend-remaining-features.md` Features 2–7.

**Acceptance criteria**: uploading a real document through the UI shows real status transitions from the backend; a real chat question returns a real, source-cited answer; all error states (validation, processing failure, AI error) surface correctly from real backend responses.

**Hard dependency**: backend Features 2 (Document Upload), 3 (Processing), 4–5 (Embeddings/Vector Store), 6–7 (RAG/Chat API) must all be implemented and running (`docs/05-backend-remaining-features.md`) before this feature can be verified — the frontend code can be written against the documented contract first, but QA requires a live backend.

### Prompt
```
You're working on the AI Document Assistant frontend at frontend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md (pay close attention to the API contract)
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/06-frontend-remaining-features.md Feature 10 in full before
writing any code.

Prerequisite: the backend must be running locally with Features 2–7
implemented (see docs/05-backend-remaining-features.md) — start it per
docs/04-development-plan.md Section 12 (uvicorn app.main:app --reload,
http://127.0.0.1:8000). Confirm NEXT_PUBLIC_API_URL in frontend/.env.local
points at it (copy from .env.local.example if missing).

Already built: lib/api/documents.mock.ts, lib/api/chat.mock.ts, and the
hooks that consume them (hooks/use-documents.ts, hooks/use-chat.ts).

Implement API Integration (frontend plan Phase 6):
1. lib/api/client.ts — a single Axios instance, baseURL from
   process.env.NEXT_PUBLIC_API_URL, a response interceptor that normalizes
   backend error responses into a consistent shape the UI can read
   (status code + message), and a reasonable request timeout.
2. lib/api/documents.ts — real implementations of listDocuments,
   uploadDocument (multipart/form-data), deleteDocument, getDocument,
   calling GET/POST/DELETE /documents* via the client from step 1 — same
   function signatures as lib/api/documents.mock.ts so hooks/use-documents.ts
   needs a one-line import change, not a rewrite.
3. lib/api/chat.ts — real sendMessage, getSessionMessages calling
   POST /chat and GET /chat/{session_id}/messages, same signatures as
   lib/api/chat.mock.ts.
4. Update hooks/use-documents.ts and hooks/use-chat.ts to import from the
   new real modules instead of the .mock ones. Delete the .mock.ts files
   once the swap is confirmed working (don't leave dead mock code mixed
   in with production paths).
5. Confirm error handling end-to-end: trigger a real 400 (bad file type),
   413 (oversized file), and a chat request with no matching content —
   confirm each renders the correct UI state (inline error / toast) using
   the real backend's error responses, not assumptions from the mock.

Verify with the backend actually running: upload a real PDF through the
UI, watch it go processing → ready via polling, ask a real question, and
confirm a real, source-cited answer renders.
```

### Guidelines & Rules
- `lib/api/client.ts` is the only place an Axios instance is constructed — no component or hook creates its own.
- No component ever calls `axios`/`fetch` directly — always through `lib/api/*.ts` via the hooks, per the frontend plan's Application Architecture section.
- Once swapped, delete the `.mock.ts` files rather than leaving them as unused dead code (per the project's no-half-finished-implementations rule).
- `NEXT_PUBLIC_API_URL` is the only way the backend URL is configured — never hardcode `http://127.0.0.1:8000` inside a component or hook.

### Security Check
- [ ] No secrets (API keys, DB credentials) are ever present in frontend code, env files prefixed `NEXT_PUBLIC_*`, or the browser network tab — only the backend base URL is public.
- [ ] File uploads still enforce client-side validation (Feature 9's Zod schema) as a UX nicety, but the UI correctly surfaces the backend's authoritative 400/413 responses rather than trusting only client-side checks.
- [ ] Error responses rendered in the UI never include raw backend stack traces (confirms Backend Feature 8's sanitization is actually working end-to-end).

### Quality Assurance
- [ ] Full real-backend flow: upload → poll status → ready → ask question → grounded answer, all using live data, no mock module involved.
- [ ] A real 400 (invalid file type) and 413 (oversized) both render the correct inline error in `FileUpload`.
- [ ] A real out-of-scope chat question renders the backend's "not available" response correctly, not a UI-level fabrication.
- [ ] Killing the backend mid-session and retrying an action shows a clear, non-crashing error state in the UI (per the frontend plan's error-handling rules).
- [ ] `lib/api/documents.mock.ts` and `lib/api/chat.mock.ts` no longer exist in the codebase after this feature is done.

---

## Feature 11 — Polish UI

### Spec
A pass across the whole app for loading states, empty states, error states, responsiveness, accessibility, and dark mode — no new functionality.

**Acceptance criteria**: every async boundary in the app has a distinct loading/empty/error visual; the app is usable at mobile width; a keyboard-only pass can reach and operate every interactive element; dark mode has no visual regressions anywhere in the app (not just the pages checked in Phase 2).

### Prompt
```
You're working on the AI Document Assistant frontend at frontend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read the approved frontend plan's Section 4 (UI/UX Planning) and
Section 8 (Styling Strategy), then docs/06-frontend-remaining-features.md
Feature 11 in full before writing any code.

Already built: all functional features (document upload/list, chat, real
API integration). This feature touches no new functionality — only
presentation polish across existing components.

Implement Polish UI (frontend plan Phase 7):
1. Audit every component that fetches data (DocumentList, ChatWindow,
   any others) and confirm each has a real loading skeleton (not a bare
   spinner) and a real empty state (using components/ui/empty-state.tsx),
   matching the patterns already used in components/documents/document-list.tsx.
2. Audit every mutation (upload, delete, send message) for error-state
   coverage — confirm each surfaces a toast AND, where relevant, an inline
   error near the control that triggered it.
3. Responsive pass: verify the dashboard's two-panel grid
   (app/dashboard/page.tsx, app/dashboard/documents/[id]/page.tsx) stacks
   sensibly at mobile widths (the plan calls for stacking or a tab switch
   — pick one, document the choice inline as a one-line comment only if
   the reasoning isn't obvious from the code).
4. Accessibility pass: confirm every interactive element (upload dropzone,
   delete button, chat input/send, theme toggle, nav links) is reachable
   and operable via keyboard alone (Tab/Enter/Space), and that
   shadcn/ui's built-in focus rings aren't being overridden anywhere.
5. Dark mode re-check: re-run the same kind of light/dark screenshot
   comparison done in Phase 2, but now across /, /dashboard (with at
   least one document and one chat message present), and /settings.

Verify with a full responsive + keyboard + dark-mode pass in a real
browser (headless Playwright screenshots are acceptable, per the pattern
used in earlier phases), not just a visual skim of the code.
```

### Guidelines & Rules
- No new components, hooks, or API calls in this feature — if you find yourself adding functionality, that belongs in a different feature.
- Reuse `components/ui/empty-state.tsx` and `components/ui/skeleton.tsx` rather than inventing new loading/empty patterns per component.
- Keep the "clean SaaS" restraint from the Styling Strategy — this pass should remove inconsistency, not add visual complexity.

### Security Check
- [ ] No security-relevant behavior changes in this feature (it's presentation-only) — confirm no validation logic was accidentally loosened while touching error-state UI.

### Quality Assurance
- [ ] Every data-fetching component has a visually distinct loading, empty, and error state (screenshot each).
- [ ] Viewport resize test across mobile (375px), tablet (768px), and desktop (1280px) widths shows no broken layout or overflow.
- [ ] Keyboard-only pass reaches and activates: upload dropzone, delete confirmation dialog (open + confirm/cancel), chat input + send, theme toggle, all nav links.
- [ ] Dark mode screenshots of `/`, `/dashboard` (with data), and `/settings` show no low-contrast text or broken component styling.
- [ ] `npm run lint` and `npx tsc --noEmit` still pass after the pass.

---

## Feature 12 — Testing

### Spec
A full manual end-to-end pass of the real user flow (per `docs/01-project-definition.md` User Workflow) plus lint/build verification, closing out the frontend before deployment prep.

**Acceptance criteria**: the complete user journey (enter app → upload → wait for processing → select document → ask question → receive grounded answer) works with zero console errors; `npm run lint` and `npm run build` both pass clean.

### Prompt
```
You're working on the AI Document Assistant frontend at frontend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md (pay close attention to the User Workflow section)
2. docs/02-architecture.md
3. docs/03-constraints.md
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/06-frontend-remaining-features.md Feature 12 in full before
starting.

Prerequisite: backend running with all Features 1–8 from
docs/05-backend-remaining-features.md implemented, frontend Features 9–11
complete.

Implement/execute Testing (frontend plan Phase 8):
1. Full manual run-through (via a headless browser driver, same approach
   used for earlier phases) of: land on "/", click "Get Started", upload
   a real multi-page PDF, watch status go processing -> ready, click into
   the document, ask a question with a known answer, confirm a correct
   source-cited reply, ask an out-of-scope question, confirm a correct
   "not available" reply, delete the document, confirm it's gone.
2. Deliberately trigger at least one error case end-to-end: upload an
   invalid file type, confirm the inline error; if feasible, stop the
   backend mid-session and confirm the UI degrades to a clear error state
   rather than hanging.
3. `npm run lint` — zero errors.
4. `npx tsc --noEmit` — zero errors.
5. `npm run build` — production build succeeds with no warnings that
   indicate unresolved issues (e.g., no accidental client/server component
   boundary errors).
6. Record any bugs found and fix them in the feature/file they belong to
   (not patched around here) before considering this feature done.

Stop once the full flow passes clean in a real (or headless) browser with
zero console errors, and lint/build are both green.
```

### Guidelines & Rules
- This feature finds and routes bugs back to their owning feature — it does not accumulate workaround code of its own.
- Use the same headless-browser verification approach (Playwright via the `run` skill pattern) established across Phases 1–4, so results are directly comparable.

### Security Check
- [ ] Full-flow browser network log reviewed once for anything unexpected leaving the client (no accidental credential/key exposure, no unexpected third-party requests).

### Quality Assurance
- [ ] Complete golden-path user journey passes with zero console errors.
- [ ] At least one deliberate error case (invalid upload) is verified end-to-end.
- [ ] `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean.
- [ ] Any bug found during this pass has a corresponding fix committed to the feature it belongs to, with the fix re-verified.

---

## Feature 13 — Deployment Readiness (Joint Backend + Frontend)

### Spec
Bring both services to a state runnable outside local dev, per `docs/04-development-plan.md` Section 15, closing out the whole project.

**Acceptance criteria**: both services boot and run correctly using only documented steps and production-style environment variables; no undocumented manual steps; final security review passes.

### Prompt
```
You're working on the AI Document Assistant, both backend/ and frontend/.

Before doing anything else, read these four docs in full, in this order:
1. docs/01-project-definition.md
2. docs/02-architecture.md
3. docs/03-constraints.md (pay close attention to the Security Constraints section)
4. docs/04-development-plan.md
Do not skip this step or skim — every rule below assumes you've read them.
Then read docs/06-frontend-remaining-features.md Feature 13 in full before
starting.

Prerequisite: all backend Features 1-8 (docs/05-backend-remaining-features.md)
and frontend Features 9-12 (this doc) are complete and verified.

Implement Deployment Readiness (docs/04-development-plan.md Section 15):
1. Finalize backend/.env.example and frontend/.env.local.example — every
   required variable present, no real secret values, comments noting
   which are required vs. have safe defaults.
2. Confirm backend boots with `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   using production-style env vars (not the dev .env), and fails fast
   with a clear error if a required variable (OPENAI_API_KEY,
   DATABASE_URL) is missing.
3. Confirm `npm run build && npm run start` succeeds for the frontend
   using a production NEXT_PUBLIC_API_URL, with no dev-only warnings.
4. Re-run the security checklist from docs/03-constraints.md Security
   Constraints end-to-end against the final codebase: secret management,
   file validation, user data protection, API security — check each item
   explicitly rather than assuming prior features covered it.
5. From a genuinely clean checkout (fresh clone or a temp directory copy),
   follow only the documented setup steps (docs/04-development-plan.md
   Section 12 backend, frontend plan Section 12) and confirm the full app
   works with zero undocumented manual steps. Note and fix any gap found.

Stop once both services run cleanly from a clean checkout using only
documented steps, and the security checklist is fully checked off.
```

### Guidelines & Rules
- No new features here — only configuration, verification, and any small fix required to unblock a documented step (e.g., a hardcoded `localhost` reference found late).
- Every environment variable used anywhere in the codebase must appear in the relevant `.env.example` file — treat a missing one as a bug.

### Security Check
(Re-verify every item from `docs/03-constraints.md` Section 5 explicitly, not by assumption)
- [ ] Secrets: no real API keys/credentials anywhere in git history or tracked files; `.env`/`.env.local` confirmed gitignored.
- [ ] File validation: extension allowlist and size limits still enforced server-side under production config.
- [ ] User data protection: deleting a document removes file + DB rows + vectors (re-confirm Feature 5's guarantee still holds end-to-end).
- [ ] API security: frontend has zero access to OpenAI/DB credentials; all error responses remain sanitized under production settings (not just dev/debug mode).

### Quality Assurance
- [ ] Clean-checkout test: following only the documented steps, both services start and the full user flow works, with no steps improvised from memory.
- [ ] Backend fails fast with a clear message if a required env var is missing (verified by actually removing one and restarting).
- [ ] `npm run build` succeeds with zero warnings that indicate a real problem (informational warnings from dependencies are fine; anything project-code-related is not).
- [ ] Full security checklist above is checked off with evidence (not just "looks fine"), and any gap found is fixed and re-verified before calling this done.

---

## Next Step

Once Feature 13 is complete, the MVP defined in `docs/01-project-definition.md` is fully implemented and deployable. Any further work (multi-document cross-referencing, summarization, auth, etc.) starts as new features layered on top of this baseline, following the same spec → prompt → guidelines → security → QA structure established here.
