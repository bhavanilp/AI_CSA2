# Complete Project Overview

## Summary

The AI Customer Support Agent is a local-first support assistant platform built around a retrieval-augmented generation flow.

The current development shape of the project is:

- local Ollama models for inference and embeddings
- persisted local vector store by default
- PostgreSQL-optional local development flow
- admin dashboard for operations and review
- chat interface for ingestion, conversations, and runtime visibility

## Running applications

### Backend API

- Port: `3000`
- Stack: Express + TypeScript
- Responsibilities:
  - auth
  - ingestion
  - vector retrieval
  - answer generation
  - escalation rules
  - metrics and admin APIs

### Admin Dashboard

- Port: `3001`
- Stack: Next.js 14 + Tailwind
- Responsibilities:
  - login
  - metrics overview
  - knowledge-source visibility
  - conversation review and transcript inspection
  - escalation rule updates
  - local settings and system health

### Chat Interface

- Port: `5173`
- Stack: React + Vite
- Responsibilities:
  - URL ingestion
  - asking questions against ingested content
  - showing activity logs
  - showing vector-store vs fallback answer state

## Core flow

1. Admin or operator ingests a URL.
2. Backend extracts content and creates embeddings.
3. Vectors are persisted to the local vector-store JSON file.
4. Startup reloads vectors and reconstructs dashboard source visibility.
5. User question is embedded and compared against stored chunks.
6. If a relevant match exists, the answer uses vector context.
7. If no relevant match exists, the system falls back to a general LLM answer and labels it accordingly.

## Current defaults

### LLM

- provider: Ollama
- model: `qwen:latest`

### Embeddings

- model: `nomic-embed-text:latest`

### Vector store

- provider: `local`
- persisted file: `backend/data/local-vector-store.json`

### Relevance threshold

- `0.60`

## Developer workflow

### Start everything

```powershell
.\start-all.ps1
```

### Build everything

```powershell
Set-Location backend
npm run build

Set-Location ..\frontend\admin-dashboard
npm run build

Set-Location ..\chat-interface
npm run build
```

### Run all automated tests

```powershell
Set-Location backend
npm test

Set-Location ..\frontend\admin-dashboard
npm test

Set-Location ..\chat-interface
npm test
```

## Current regression protections

The automated tests now cover the highest-value regressions fixed in this repository:

- vector-store answer path
- non-vector fallback answer path
- timeout-safe LLM failure handling
- dashboard transcript drill-down
- dashboard settings persistence
- chat startup URL display
- chat fallback badge rendering

## Known boundaries

- The local development environment still uses an in-memory DB fallback when PostgreSQL is unavailable.
- The admin dashboard is operational, but it is not yet a multi-tenant production console.
- The `frontend/chat-widget` package exists in the repository but is not the primary UI used in the current startup flow.