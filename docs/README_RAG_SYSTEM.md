# RAG System Notes

## Current retrieval pipeline

1. Generate an embedding for the user query using `nomic-embed-text:latest`.
2. Query the vector store with an expanded candidate pool.
3. Apply lightweight lexical/entity-aware reranking to improve factual/entity matching.
4. Filter out matches below `VECTOR_RELEVANCE_THRESHOLD` (default `0.55`).
5. Build context from at most 3 chunks.
6. Truncate each chunk to 800 characters before sending context to the LLM.
7. Call Ollama using the configured chat model (startup default: `qwen3.5:2b`).
8. If no relevant match exists, return a general LLM answer and label it as non-vector-backed.

## Storage model

- Default provider: local JSON vector store
- File path: `backend/data/local-vector-store.json`
- Persisted content:
  - vectors
  - metadata including `source_url`
  - startup-ingested URL reconstruction

## Runtime notes

- The local store is reloaded at backend startup.
- The sources dashboard is repopulated from persisted URL metadata on startup.
- Health output includes ingested URL count and URL list.

## User-facing behavior

- Vector-backed answers show a positive vector badge in the chat UI.
- Non-vector answers show a fallback note and explanation.
- Assistant replies are rendered as Markdown in the chat UI.
- Chat replies include per-response token usage (`prompt`, `completion`, `total`).
- Chat includes a `Show thinking` toggle; when enabled, thinking traces are shown.
- Admin users can inspect transcripts in the dashboard.