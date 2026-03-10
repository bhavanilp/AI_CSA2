# Vector Data Architecture

## Default mode

The repository currently defaults to a local file-backed vector store.

## File location

- `backend/data/local-vector-store.json`

## Stored shape

Each vector entry stores:

- `id`
- `values`
- `metadata`

Important metadata fields include:

- `organization_id`
- `source_id`
- `source_name`
- `source_url`
- `chunk_text`

## Lifecycle

### On ingestion

- extracted content is chunked
- chunks are embedded
- vectors are upserted into the local store
- the store is immediately rewritten to disk

### On startup

- the backend loads all persisted vectors
- `getIngestedSourceUrls()` derives a unique URL list from vector metadata
- the app syncs those URLs into the in-memory sources table so the dashboard remains populated

### On query

- cosine similarity is computed in-process for local vectors
- results are sorted by descending score
- only results above the current relevance threshold are used for context

## Operational notes

- local persistence survives backend restarts
- in-memory dashboard tables do not survive restart by themselves, which is why the startup sync exists
- Pinecone support remains available for non-local deployments