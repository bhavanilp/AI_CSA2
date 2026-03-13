# Component Specs

## Backend components

### Chat service

- file: `backend/src/services/chatService.ts`
- responsibilities:
  - embedding request generation
  - vector retrieval
  - escalation keyword matching
  - vector-backed or fallback answer generation
  - confidence reason generation
  - per-turn response-time measurement
  - conversation persistence

### LLM service

- file: `backend/src/services/llmService.ts`
- responsibilities:
  - Ollama completion calls
  - embedding calls
  - prompt shaping and timeouts

### Vector store config

- file: `backend/src/config/vectorDb.ts`
- responsibilities:
  - local file persistence
  - Pinecone integration when enabled
  - retrieval and deletion APIs

## Admin dashboard components

### Overview page

- metrics cards
- operations snapshot links

### Sources page

- ingested URL list
- source records table

### Conversations page

- session list
- feedback actions
- transcript drawer
- per-message response time and confidence reason display

### Escalation rules page

- rule list
- enabled toggle
- escalation email editor

### Settings page

- admin profile
- backend health
- local UI preference persistence

## Chat interface components

### Main app

- auto-login on load
- startup ingested URL announcement
- URL ingestion form
- chat thread
- activity log panel
- vector/fallback badges
- per-request/response response-time display
- confidence score reason in brackets
- editor tab removed