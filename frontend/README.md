# AI Document Assistant — Frontend

Next.js 15 client for uploading documents and chatting with them. See
`../docs/02-architecture.md` for the full architecture. The backend must
be running first — see `../backend/README.md`.

## Prerequisites

- Node.js 20+
- The backend running and reachable (defaults to `http://127.0.0.1:8000`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env file and adjust if your backend runs elsewhere:
   ```bash
   cp .env.local.example .env.local
   ```
   `NEXT_PUBLIC_API_URL` is required — see `.env.local.example` for
   details. There is no fallback if it's unset.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`. If port 3000 is already in use, Next.js
   automatically starts on the next free port (3001, etc.) — check the
   terminal output for the actual URL.

## Running in production

```bash
NEXT_PUBLIC_API_URL=https://your-backend.example.com npm run build
npm run start
```
`NEXT_PUBLIC_API_URL` is baked into the client bundle at build time —
set it to the real backend URL *before* running `npm run build`,
not just before `npm run start`.

## Testing

```bash
npm run lint
```
