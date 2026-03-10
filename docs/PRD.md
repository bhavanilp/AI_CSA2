# Product Requirements Summary

## Product goal

Provide a locally runnable customer-support assistant that can ingest external content, answer grounded questions from that content, and expose an admin workflow for monitoring and tuning behavior.

## Current functional requirements

- ingest website content into a vector store
- persist ingested vector data locally across backend restarts
- answer questions with vector context when relevant
- fall back to a general LLM answer when the question is not relevant to the vector store
- clearly indicate to the user whether the answer used vector context
- authenticate admins for operational views
- show metrics, sources, conversations, escalation rules, and settings in the dashboard
- allow transcript inspection and admin feedback on conversations

## Non-functional requirements

- runnable on a local Windows workstation
- usable with Ollama instead of a hosted LLM
- resilient when PostgreSQL or Redis are unavailable in local development
- fast enough to avoid common Ollama timeouts through prompt-size controls

## Operational defaults

- backend on `3000`
- admin dashboard on `3001`
- chat interface on `5173`
- local vector store by default