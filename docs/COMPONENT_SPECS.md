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
  - token usage capture for sync and streaming responses
  - final-answer fallback handling for streaming responses
  - per-turn response-time measurement
  - conversation persistence

### LLM service

- file: `backend/src/services/llmService.ts`
- responsibilities:
  - Ollama completion calls
  - embedding calls
  - per-request thinking toggle support
  - token-usage extraction
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
- token usage metrics cards
- operations snapshot links

### Sources page

- ingested URL list
- source records table

### Conversations page

- session list
- feedback actions
- transcript drawer
- per-message response time, confidence reason, and token usage display

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
- markdown rendering for assistant messages
- per-response token usage metadata
- per-response feedback actions (thumbs up/down)
- per-response copy action
- `Show thinking` toggle and thinking-trace display
- editor tab removed