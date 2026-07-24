# AI Document Assistant — Project Definition Document

Status: Source of truth. To be read in full before any development work begins.

---

## 1. Project Overview

**Project Name:** AI Document Assistant

**What it is:** A web application that lets a user upload documents (PDF, DOCX, TXT), then converse with an AI assistant that answers questions using only the content of those documents. The assistant retrieves relevant passages from the uploaded material and generates grounded, source-backed answers instead of relying on general knowledge.

**Why this product exists:** People and teams accumulate large volumes of documents (reports, contracts, manuals, research papers, notes) that are difficult to search and even harder to reason about quickly. Reading through long documents to find a specific answer is slow. Generic AI chat tools cannot answer questions about private documents because they have no access to that content. This product closes that gap by combining document storage with retrieval-augmented AI reasoning.

**The problem it solves:** Users need fast, accurate answers grounded in their own documents, without manually searching, re-reading, or summarizing long files themselves, and without exposing that content to an AI model in an unstructured, ungrounded way that risks inaccurate or fabricated answers.

**The target user:** Individuals and small teams who work with a moderate volume of text-heavy documents and need quick, trustworthy answers from that material — for example, someone reviewing reports, studying reference material, or searching internal documentation.

**The expected user experience:** The user opens the application, uploads one or more documents, waits briefly while the system processes them, and then asks questions in a chat interface. Answers arrive with references to the source material they came from. The experience should feel closer to "asking a knowledgeable assistant who has read the document" than to a generic search bar.

---

## 2. Product Scope

**MVP Features:**
- Upload documents (PDF, DOCX, TXT)
- Automatic processing of uploaded documents into a searchable form
- Chat-based question answering grounded in uploaded documents
- Answers reference which document/section they came from
- View, list, and delete uploaded documents
- Persisted chat history per session

**Main functionality:** Turn unstructured document content into a queryable knowledge base and expose that knowledge base through a conversational interface.

**What the system should achieve:**
- Accurate answers grounded strictly in the user's own documents
- Fast turnaround between upload and first usable question
- A clear, understandable answer flow the user can trust (i.e., not silently guessing when the answer isn't in the documents)
- A foundation that can grow into more advanced document intelligence features without a rebuild

---

## 3. Core Features

**Document Upload**
Users upload one or more supported files through the interface. The system validates file type and size before accepting the upload and confirms receipt immediately, while processing continues in the background.

**Document Processing**
Uploaded files are converted from raw file formats into clean, structured text, then split into manageable pieces suitable for semantic search. This step is fully automatic and requires no user action beyond uploading.

**AI Document Conversation**
Users interact with their documents through natural-language chat rather than static search. The assistant maintains conversational context within a session.

**Question Answering**
The assistant answers user questions using only information retrieved from the relevant documents. If the answer is not present in the documents, the assistant says so rather than fabricating a response.

**RAG Workflow (Retrieval-Augmented Generation)**
Instead of sending entire documents to the AI model, the system retrieves only the most relevant fragments of text for a given question and provides those as context to the model when generating an answer. This keeps answers accurate, grounded, and cost-efficient.

**Document Management**
Users can view a list of their uploaded documents, check processing status, and delete documents they no longer need (which also removes their indexed content).

**Future Expansion Possibilities**
- Multi-document cross-referencing in a single answer
- Document summarization on demand
- Support for additional file types (scanned images via OCR, spreadsheets, presentations)
- Team/workspace sharing of document collections
- Streaming responses (token-by-token) in the chat interface
- Usage analytics and cost tracking for AI calls

---

## 4. User Workflow

1. **User enters the application** — lands on the main interface, sees existing documents (if any) and a chat entry point.
2. **User uploads documents** — selects one or more supported files; the system accepts and queues them for processing.
3. **System processes documents** — text is extracted, cleaned, and split into chunks suitable for search.
4. **AI creates searchable knowledge** — each chunk is converted into a vector embedding and stored in the vector database, indexed against its source document.
5. **User asks questions** — the user types a natural-language question in the chat interface, optionally scoped to a specific document.
6. **System retrieves relevant information** — the question is embedded and compared against stored document chunks to find the most relevant matches.
7. **AI generates answers** — the retrieved chunks are provided as context to the AI model, which produces a grounded answer.
8. **User receives responses** — the answer is displayed in the chat, along with references to the source document(s) it was drawn from.

---

## 5. Technology Purpose

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 15** | Provides the application framework and routing for the web client, with support for server and client components, enabling a fast, production-ready UI. |
| **TypeScript** | Adds static typing across the frontend codebase, catching integration errors (e.g., mismatched API response shapes) before runtime. |
| **Tailwind CSS** | Utility-first styling system used to build the interface consistently and quickly without maintaining large separate stylesheets. |
| **shadcn/ui** | Provides accessible, pre-built UI components (dialogs, forms, buttons, chat elements) that are customizable and consistent, avoiding the need to build every UI primitive from scratch. |
| **TanStack Query** | Manages server-state on the client — fetching, caching, and synchronizing data from the backend API (document lists, processing status, chat messages) with built-in loading/error states and refetching. |

### Backend

| Technology | Purpose |
|---|---|
| **Python** | The implementation language for the backend, chosen for its strong ecosystem of AI/ML and document-processing libraries. |
| **FastAPI** | The web framework that exposes the backend as an HTTP API, handling request validation, routing, and async I/O for calls to the database and OpenAI. |
| **PostgreSQL** | The relational database that stores structured data: documents, chunks, chat sessions, and chat messages. |
| **SQLAlchemy** | The ORM layer that maps Python objects to PostgreSQL tables, used for all structured data access and schema migrations. |

### AI

| Technology | Purpose |
|---|---|
| **OpenAI API** | Generates the natural-language answers in the chat, using retrieved document context to ground its responses. |
| **OpenAI Embeddings** | Converts document text chunks and user questions into numerical vectors so that semantic similarity between them can be measured. |
| **RAG Architecture** | The overall pattern that ties retrieval (finding relevant document chunks) and generation (producing an answer from those chunks) together — this is what makes answers grounded rather than purely model-generated. |
| **Vector Database (ChromaDB)** | Stores the embeddings generated from document chunks and performs fast similarity search to find the most relevant chunks for a given question. |
