# Fine-Tuning Summary

This file summarizes the runtime tuning that has already been applied in code.

## Retrieval tuning

- relevance threshold is configurable through `VECTOR_RELEVANCE_THRESHOLD` (local default `0.55`)
- expanded candidate retrieval is used before threshold filtering
- lexical/entity-aware reranking improves factual/entity retrieval (for example, location/population queries)

## Context-size tuning

- limit LLM context to 3 chunks
- limit each chunk to 800 characters
- keep prompts short enough for local Ollama execution

## Embedding tuning

- embedding input truncated to reduce latency
- embedding requests use a dedicated timeout

## Answer-path tuning

- vector-backed answers are used only when relevant matches exist
- fallback answers are labeled clearly in the UI
- timeout-safe errors return a user-readable response instead of a raw failure
- thinking-enabled requests fall back to non-thinking generation if response tokens are missing
- streaming `done` event includes `final_answer` and token usage metadata

## Dashboard tuning

- blank-page redirect issue fixed
- `/api/*` requests are proxied through the Next.js dashboard app
- conversations now support transcript drill-down
- dashboard overview includes token metrics cards
- transcript drawer includes per-message token usage