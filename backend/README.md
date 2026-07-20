# AI Document Assistant — Backend

FastAPI service that handles document upload/processing, embeddings, vector
search (ChromaDB), and RAG-based chat over uploaded documents. See
`../docs/02-architecture.md` for the full architecture.

## Prerequisites

- Python 3.11+ (developed against 3.14)
- PostgreSQL running and reachable (local install or a hosted instance)
- An OpenAI API key

## Setup

1. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create the PostgreSQL database (name must match `DATABASE_URL` below):
   ```bash
   createdb "Ai Document Assistant"
   ```
4. Copy the env file and fill in real values:
   ```bash
   cp .env.example .env
   ```
   At minimum, set `OPENAI_API_KEY` to a real key. `DATABASE_URL` already
   points at the database created in step 3 by default — adjust it if your
   PostgreSQL user/password/host differ. Both `DATABASE_URL` and
   `OPENAI_API_KEY` are required; the app will refuse to start without
   them (see "Fail-fast behavior" below).
5. Run database migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The API is now at `http://127.0.0.1:8000`; interactive docs at
   `http://127.0.0.1:8000/docs`. `storage/uploads/` and
   `storage/chroma/` are created automatically on first use — no manual
   directory setup needed.

## Running in production

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Do not pass `--reload` in production. Set real environment variables
(directly in the process environment, via your platform's secrets/env
manager, or via `.env` — see `.env.example` for the full list and which
are required vs. have safe defaults) rather than committing a `.env` file.
Set `ENVIRONMENT=production` and `CORS_ALLOWED_ORIGINS` to your real
deployed frontend origin(s).

## Fail-fast behavior

`OPENAI_API_KEY` and `DATABASE_URL` have no defaults. If either is
missing, the app raises a `pydantic.ValidationError` and exits
immediately at import time, before binding to a port — it will not boot
into a broken state. Everything else in `.env.example` has a safe
default and is optional to override.

## Testing

```bash
pytest
```

## Migrations

New model changes need a new revision:
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```
