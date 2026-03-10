# RAG System Notes

## Current retrieval pipeline

1. Generate an embedding for the user query using `nomic-embed-text:latest`.
2. Query the vector store for the top `k` matches.
3. Filter out matches below the relevance threshold of `0.60`.
4. Build context from at most 3 chunks.
5. Truncate each chunk to 400 characters before sending context to the LLM.
6. Call `qwen:latest` through Ollama.
7. If no relevant match exists, return a general LLM answer and label it as non-vector-backed.

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
- Admin users can inspect transcripts in the dashboard.