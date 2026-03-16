# Implementation Index

This file tracks what is implemented in the current repository state.

## Backend

### Runtime

- `backend/src/index.ts`
  - graceful shutdown using the actual HTTP server handle
  - `SIGINT` and `SIGTERM` handling

- `backend/package.json`
  - `ts-node-dev --respawn --exit-child` for cleaner restarts

### Data and persistence

- `backend/src/config/vectorDb.ts`
  - local JSON vector-store persistence
  - startup load from `backend/data/local-vector-store.json`
  - `getIngestedSourceUrls()` helper

- `backend/src/config/database.ts`
  - PostgreSQL connection when available
  - in-memory fallback implementation for local development
  - in-memory support for sources, conversations, escalation rules, and metrics

- `backend/src/app.ts`
  - startup sync from persisted vector-store URLs into the in-memory sources table

### API routes

- `backend/src/api/health.ts`
  - service health
  - vector-store URL count and ingested URL list

- `backend/src/api/auth.ts`
  - login
  - refresh token flow

- `backend/src/api/chat.ts`
  - `POST /api/chat/message`
  - `POST /api/chat/message/stream`
  - `GET /api/chat/ingested-urls`
  - `GET /api/chat/conversation/:id`
  - `POST /api/chat/escalate`

- `backend/src/api/admin.ts`
  - metrics (average response time derived from per-turn bot latency, not conversation lifetime)
  - sources CRUD
  - source URL removal from vector store (`POST /api/admin/sources/remove-url`)
  - ingest URL
  - conversations list
  - conversation feedback
  - escalation rules read/update

### Services

- `backend/src/services/chatService.ts`
  - configurable vector retrieval threshold (`VECTOR_RELEVANCE_THRESHOLD`, local default `0.55`)
  - lexical/entity-aware reranking and expanded retrieval candidate pool
  - 3-context-chunk cap
  - 800-char chunk cap
  - fallback answer path when no relevant vector hit exists
  - non-vector note for UI display
  - timeout-safe user-facing error
  - per-turn `response_time_sec` captured and persisted in bot messages
  - `confidence_reason` generated and returned with confidence score
  - `token_usage` captured and persisted in bot messages
  - stream `done` payload includes `final_answer` and `token_usage`
  - thinking-enabled stream fallback to non-thinking generation when response tokens are missing

- `backend/src/services/llmService.ts`
  - Ollama generation through configured model (startup default `qwen3.5:2b`)
  - embeddings through `nomic-embed-text:latest`
  - prompt and timeout tuning for local execution
  - per-request thinking mode toggle support
  - token-usage extraction for sync/streaming calls

## Admin dashboard

- `frontend/admin-dashboard/app/auth/login/page.tsx`
  - proxied login via `/api/auth/login`

- `frontend/admin-dashboard/app/dashboard/layout.tsx`
  - blank-page redirect bug fixed

- `frontend/admin-dashboard/app/dashboard/page.tsx`
  - metrics overview with corrected average response time
  - token usage metrics cards (total tokens, avg tokens/response)
  - operations snapshot links

- `frontend/admin-dashboard/app/dashboard/sources/page.tsx`
  - ingested URL list
  - remove URL action (deletes vectors for that URL)
  - source record table

- `frontend/admin-dashboard/app/dashboard/conversations/page.tsx`
  - conversation table
  - feedback actions
  - transcript drill-down drawer
  - per-message response time, confidence reason, and token usage display in transcript

- `frontend/admin-dashboard/app/dashboard/escalation-rules/page.tsx`
  - enable/disable rules
  - escalation email editing

- `frontend/admin-dashboard/app/dashboard/settings/page.tsx`
  - system health
  - admin profile panel
  - local UI preferences

## Chat interface

- `frontend/chat-interface/src/App.jsx`
  - startup URL list
  - URL ingestion
  - vector-store answer badge
  - non-vector fallback badge
  - activity log view
  - per-request round-trip time and per-response latency display
  - confidence score reason display
  - markdown rendering for assistant replies
  - `Show thinking` toggle per request
  - per-response token usage display
  - per-reply feedback actions (thumbs up/down)
  - per-reply copy response action
  - editor tab removed

## Automated tests

- `backend/tests/chatService.test.ts`
  - backend unit and regression coverage

- `frontend/admin-dashboard/app/dashboard/conversations/page.test.tsx`
  - transcript drawer and feedback flow

- `frontend/admin-dashboard/app/dashboard/settings/page.test.tsx`
  - settings health and local preference persistence

- `frontend/chat-interface/src/App.test.jsx`
  - startup URL rendering and fallback badge coverage