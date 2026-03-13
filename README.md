# AI Customer Support Agent

A local-first RAG customer-support system with three running applications:

- Backend API on `http://localhost:3000`
- Admin Dashboard on `http://localhost:3001`
- Chat Interface on `http://localhost:5173`

The current implementation uses Ollama for generation and embeddings, a persisted local JSON vector store by default, and an in-memory fallback database when PostgreSQL is not available.

## Current Status

- Local vector-store persistence is implemented in `backend/data/local-vector-store.json`
- Ingested URLs are loaded on startup and exposed through `/api/chat/ingested-urls`
- Non-vector answers are clearly marked in the chat UI
- Each request/response turn now shows response time in seconds in the chat UI
- Confidence is shown with an explanatory reason in the chat UI
- Dashboard routes are implemented for overview, sources, conversations, escalation rules, and settings
- The backend gracefully shuts down and `ts-node-dev` is configured with `--exit-child`

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Ollama running locally
- Ollama models:
  - `qwen:latest`
  - `nomic-embed-text:latest`

### Pull Ollama models

```powershell
ollama pull qwen:latest
ollama pull nomic-embed-text:latest
```

### One-time machine setup (new machine)

```powershell
.\setup-environment.ps1 -PullOllamaModels
```

This script:

- validates Node.js/npm prerequisites
- creates local backend runtime folders (`data`, `logs`, `uploads`)
- creates `backend/.env` with local-first defaults (local vector store + Ollama)
- installs npm dependencies for backend and frontend apps
- optionally pulls Ollama models when `-PullOllamaModels` is provided

### Start everything

```powershell
.\start-all.ps1
```

The script will:

- free ports `3000`, `3001`, and `5173`
- install missing `node_modules`
- start backend, dashboard, and chat interface
- wait for backend health before starting the UIs

### Access URLs

- Chat Interface: `http://localhost:5173`
- Admin Dashboard: `http://localhost:3001`
- Backend API: `http://localhost:3000`

### Default admin credentials

- Email: `admin@aicsa.local`
- Password: `Admin@123`

## Architecture Summary

### Backend

- Express + TypeScript
- JWT auth
- Chat orchestration in `backend/src/services/chatService.ts`
- Ollama integration in `backend/src/services/llmService.ts`
- Local or Pinecone vector store in `backend/src/config/vectorDb.ts`
- In-memory database fallback in `backend/src/config/database.ts`

### Admin Dashboard

- Next.js 14
- Proxies `/api/*` to the backend via `next.config.js`
- Implemented pages:
  - Dashboard overview
  - Knowledge sources
  - Conversations with transcript drill-down
  - Escalation rules editor
  - Settings and system health

### Chat Interface

- React + Vite
- Auto-authenticates with default admin credentials in local development
- Can ingest URLs
- Shows startup ingested URLs
- Marks answers that did not use vector-store context
- Shows per-turn response time in seconds and confidence reason

## Important Runtime Behavior

### Vector retrieval threshold

The backend currently treats vector matches below `0.60` as irrelevant and falls back to a general LLM answer.

### Prompt sizing

To avoid Ollama timeouts, the backend limits vector context to:

- top 3 relevant chunks
- 400 characters per chunk

### Startup sync

When using the local vector store, the backend syncs persisted ingested URLs into the in-memory sources table during startup so the dashboard remains populated after restarts.

## Testing

### Backend

```powershell
Set-Location backend
npm test
```

### Admin Dashboard

```powershell
Set-Location frontend/admin-dashboard
npm test
```

### Chat Interface

```powershell
Set-Location frontend/chat-interface
npm test
```

### Production builds

```powershell
Set-Location backend
npm run build

Set-Location ..\frontend\admin-dashboard
npm run build

Set-Location ..\chat-interface
npm run build
```

## Key APIs

### Public chat APIs

- `POST /api/chat/message`
- `POST /api/chat/message/stream`
- `GET /api/chat/ingested-urls`
- `GET /api/chat/conversation/:id`
- `POST /api/chat/escalate`

### Auth APIs

- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Admin APIs

- `GET /api/admin/metrics`
- `GET /api/admin/sources`
- `POST /api/admin/sources`
- `DELETE /api/admin/sources/:id`
- `POST /api/admin/sources/remove-url`
- `POST /api/admin/sources/ingest-url`
- `GET /api/admin/conversations`
- `POST /api/admin/conversations/:id/feedback`
- `GET /api/admin/escalation-rules`
- `PUT /api/admin/escalation-rules/:id`

## Documentation Map

- `docs/SETUP.md` for local setup and startup flow
- `docs/TESTING_GUIDE.md` for automated and manual verification
- `docs/IMPLEMENTATION_INDEX.md` for the implemented feature index
- `docs/COMPLETE_README.md` for the full project overview