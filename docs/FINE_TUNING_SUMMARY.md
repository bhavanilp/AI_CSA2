# Fine-Tuning Summary

This file summarizes the runtime tuning that has already been applied in code.

## Retrieval tuning

- relevance threshold raised to `0.60`
- irrelevant results around `0.46` to `0.47` no longer trigger vector-backed answers
- relevant results around `0.67` to `0.70` still pass the threshold

## Context-size tuning

- limit LLM context to 3 chunks
- limit each chunk to 400 characters
- keep prompts short enough for local Ollama execution

## Embedding tuning

- embedding input truncated to reduce latency
- embedding requests use a dedicated timeout

## Answer-path tuning

- vector-backed answers are used only when relevant matches exist
- fallback answers are labeled clearly in the UI
- timeout-safe errors return a user-readable response instead of a raw failure

## Dashboard tuning

- blank-page redirect issue fixed
- `/api/*` requests are proxied through the Next.js dashboard app
- conversations now support transcript drill-down