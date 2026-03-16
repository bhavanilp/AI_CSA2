# Tech Stack Setup

## Backend

- Node.js 18+
- Express 4
- TypeScript 5
- Jest + ts-jest for backend tests
- Winston logging

## LLM and embeddings

- Ollama
- `qwen3.5:2b` (startup default) for answer generation
- `nomic-embed-text:latest` for embeddings

## Data layer

- Local JSON vector store by default
- Pinecone support still exists in code but is not the default local workflow
- PostgreSQL optional
- In-memory DB fallback for local development
- Redis disabled in the default local startup flow

## Frontends

### Admin dashboard

- Next.js 14
- React 18
- Tailwind CSS
- Jest + Testing Library

### Chat interface

- Vite
- React 18
- Vitest + Testing Library

### Chat widget

- Vite
- TypeScript
- Vitest

## Default local ports

- `3000` backend
- `3001` admin dashboard
- `5173` chat interface