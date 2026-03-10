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
  - `GET /api/chat/ingested-urls`
  - `GET /api/chat/conversation/:id`
  - `POST /api/chat/escalate`

- `backend/src/api/admin.ts`
  - metrics
  - sources CRUD
  - ingest URL
  - conversations list
  - conversation feedback
  - escalation rules read/update

### Services

- `backend/src/services/chatService.ts`
  - vector retrieval threshold of `0.60`
  - 3-context-chunk cap
  - 400-char chunk cap
  - fallback answer path when no relevant vector hit exists
  - non-vector note for UI display
  - timeout-safe user-facing error

- `backend/src/services/llmService.ts`
  - Ollama generation through `qwen:latest`
  - embeddings through `nomic-embed-text:latest`
  - prompt and timeout tuning for local execution

## Admin dashboard

- `frontend/admin-dashboard/app/auth/login/page.tsx`
  - proxied login via `/api/auth/login`

- `frontend/admin-dashboard/app/dashboard/layout.tsx`
  - blank-page redirect bug fixed

- `frontend/admin-dashboard/app/dashboard/page.tsx`
  - metrics overview
  - operations snapshot links

- `frontend/admin-dashboard/app/dashboard/sources/page.tsx`
  - ingested URL list
  - source record table

- `frontend/admin-dashboard/app/dashboard/conversations/page.tsx`
  - conversation table
  - feedback actions
  - transcript drill-down drawer

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

## Automated tests

- `backend/tests/chatService.test.ts`
  - backend unit and regression coverage

- `frontend/admin-dashboard/app/dashboard/conversations/page.test.tsx`
  - transcript drawer and feedback flow

- `frontend/admin-dashboard/app/dashboard/settings/page.test.tsx`
  - settings health and local preference persistence

- `frontend/chat-interface/src/App.test.jsx`
  - startup URL rendering and fallback badge coverage