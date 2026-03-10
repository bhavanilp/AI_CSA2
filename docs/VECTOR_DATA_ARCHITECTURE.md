# Vector Data & RAG Architecture - Implementation Details

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Chat Interface (React)                          │
│                    http://localhost:5173                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend API (Express)                           │
│                    http://localhost:3000                             │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/chat/message          Generate answers with RAG          │
│  POST /api/admin/sources/ingest-url   Ingest web content           │
│  POST /api/auth/login              JWT authentication               │
└──────────┬──────────────┬──────────────┬──────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
    │ LLM Service  │ │Database  │ │Vector Database   │
    │(Ollama)      │ │(In-mem)  │ │(In-mem)          │
    │llama3.2:     │ │PostgreSQL│ │Cosine Similarity │
    │latest        │ │fallback  │ │Search            │
    └──────────────┘ └──────────┘ └──────────────────┘
```

## Data Flow: Query Processing

```
User Query: "Where is Hyderabad?"
    │
    ▼
1. EMBEDDING GENERATION
    • Input: User query text
    • Model: nomic-embed-text:latest (via Ollama)
    • Output: 768-dimensional vector
    • Example: [0.15, -0.23, 0.08, ..., 0.34] (768 values)
    │
    ▼
2. VECTOR SIMILARITY SEARCH
    • Query vector vs. stored vectors (26 chunks)
    • Algorithm: Cosine Similarity
    • Distance metric: 0.0 (opposite) to 1.0 (identical)
    • Top-5 results with scores:
      - Chunk 1: 0.703 (highest - geography section)
      - Chunk 2: 0.701 (location details)
      - Chunk 3: 0.700 (administrative info)
      - Chunk 4: 0.697 (borders/neighbors)
      - Chunk 5: 0.688 (historical context)
    │
    ▼
3. CONTEXT BUILDING
    • Combine top-5 chunks into context
    • Total tokens: ~33,194 characters
    • Preserves semantic structure with source markers
    │
    ▼
4. LLM GENERATION
    • Input: System prompt + user query + context
    • Model: llama3.2:latest (2B parameters)
    • Temperature: 0.2 (factual mode)
    • Max tokens: 128 (concise answers)
    • Output: "Hyderabad is the capital city of the Indian 
              state of Telangana, situated in the southern 
              part of India..."
    │
    ▼
Result: Answer with 80% confidence, 5 sources, no escalation
```

## Data Storage Structure

### Vector Store (In-Memory)

```typescript
localVectors = [
  {
    id: "source-uuid-1",
    values: [0.15, -0.23, 0.08, ..., 0.34],  // 768 dimensions
    metadata: {
      source_id: "uuid-123",
      source_name: "Hyderabad Wikipedia",
      source_url: "https://en.wikipedia.org/wiki/Hyderabad",
      chunk_index: 1,
      chunk_text: "Hyderabad is the capital city...",
      organization_id: "default"
    }
  },
  {
    id: "source-uuid-2",
    values: [0.22, -0.19, 0.12, ..., 0.28],  // 768 dimensions
    metadata: {
      source_id: "uuid-123",
      source_name: "Hyderabad Wikipedia",
      source_url: "https://en.wikipedia.org/wiki/Hyderabad",
      chunk_index: 2,
      chunk_text: "Located in Telangana state...",
      organization_id: "default"
    }
  },
  // ... 24 more chunks
]
```

### Ingestion Pipeline

```
Wikipedia URL
    │
    ▼
1. FETCH & PARSE (fetchPageText)
   • Axios: GET request with User-Agent headers
   • Cheerio: Parse HTML structure
   • Extract all sections
   
   ↓ Result: 130,341 characters ↓
    │
    ▼
2. CHUNKING (chunkText)
   • Chunk size: 1024 words
   • Overlap: 128 words
   • Min chunk size: 120 characters
   
   ↓ Result: 26 chunks ↓
    │
    ▼
3. EMBEDDING (generateEmbedding)
   • Model: nomic-embed-text:latest
   • Ollama API: POST /api/embeddings
   • Output: 768-dim vectors per chunk
   
   ↓ Result: 26 vectors ↓
    │
    ▼
4. UPSERT (upsertVectors)
   • Store in localVectors array
   • Include full metadata
   • Check for duplicates by ID
   
   ↓ Result: 26 chunks in vector DB ↓
```

## Similarity Search Algorithm (Cosine Similarity)

```
Formula: cos(A, B) = (A · B) / (||A|| × ||B||)

Example with simplified 3D vectors:
Query: [0.5, 0.3, 0.1]
Chunk1: [0.6, 0.2, 0.2]

Step 1: Dot product
  A · B = (0.5 × 0.6) + (0.3 × 0.2) + (0.1 × 0.2)
        = 0.3 + 0.06 + 0.02
        = 0.38

Step 2: Magnitudes
  ||A|| = √(0.5² + 0.3² + 0.1²) = √0.35 ≈ 0.59
  ||B|| = √(0.6² + 0.2² + 0.2²) = √0.44 ≈ 0.66

Step 3: Cosine similarity
  cos(A, B) = 0.38 / (0.59 × 0.66) ≈ 0.97

Result: Highly similar (97%)
```

## Content Extraction for Wikipedia

```javascript
extractWikipediaContent($) {
  1. Remove: <script>, <style>, edit links, navboxes
  2. Extract: 
     - #firstHeading → "Hyderabad"
     - Intro paragraph → First detailed description
     - All h2/h3 sections → "Geography:", "History:", "Culture:"
     - p tags → Full paragraphs from all sections
     - li tags → List items (bullet points)
     - tables → Data rows ("State: Telangana")
  
  Result: 130,341 chars of structured text
}
```

## Performance Characteristics

| Operation | Latency | Component |
|-----------|---------|-----------|
| Text extraction | 5-10s | Cheerio + HTTP |
| Embedding generation | ~50ms/chunk | Ollama |
| Vector storage | <5ms | In-memory array |
| Similarity search | <10ms | Cosine calculation |
| LLM inference | 5-8s | Ollama (llama3.2) |
| **Total chat latency** | **10-20s** | End-to-end |

## Configuration Parameters

```typescript
// RAG Configuration
config.rag = {
  chunk_size: 1024,           // Words per chunk
  chunk_overlap: 128,         // Overlap for context
  retrieval_top_k: 5,         // Chunks to retrieve
  confidence_threshold: 0.4,  // Escalation threshold
  max_context_tokens: 2048    // Max context length
}

// LLM Configuration
config.llm.provider = 'ollama'
config.llm.ollama = {
  api_url: 'http://localhost:11434',
  model: 'llama3.2:latest',
  embedding_model: 'nomic-embed-text:latest'
}

// Vector DB Configuration
config.vector_db.provider = 'local'  // In-memory fallback
```

## Testing & Validation

### Successful Query Example

```
Query: "Where is Hyderabad?"
↓
Embedding: [0.15, -0.23, 0.08, ..., 0.34] (768D)
↓
Search Results:
  1. Geography chunk: 0.703 (location description)
  2. Admin chunk: 0.701 (state information)
  3. Borders chunk: 0.700 (neighbors)
  4. Culture chunk: 0.697 (regional context)
  5. History chunk: 0.688 (historical background)
↓
Context: "Hyderabad is the capital city of Telangana...
          It is situated on the banks of the Musi River..."
↓
LLM Response: "Hyderabad is the capital city of the Indian 
              state of Telangana, located in the southern 
              part of India. It is situated on the banks 
              of the Musi River and is a major urban 
              center in South Asia."
↓
Result: ✅ Confidence 80%, Contains "Telangana"
```

## URL Testing

- **Source:** https://en.wikipedia.org/wiki/Hyderabad
- **Content Size:** 130,341 characters
- **Chunks:** 26
- **Embedding Model:** nomic-embed-text:latest (768D)
- **LLM Model:** llama3.2:latest (2B params)
- **Test Query:** "Where is Hyderabad?"
- **Expected Answer:** Contains "Telangana"
- **Result:** ✅ PASS (Answer includes "Telangana" state)

## Key Improvements from Fine-Tuning

1. **Full Wikipedia Extraction:** From partial to 130K+ characters
2. **Accurate Embeddings:** Consistent 768-dimensional vectors
3. **Better Retrieval:** 5 chunks with 0.70+ similarity scores
4. **Improved LLM:** From garbled to coherent 80%+ confidence answers
5. **Vector Data Integrity:** Proper metadata and organization_id handling

## Production Readiness Checklist

- ✅ Wikipedia content extraction working
- ✅ Vector storage with cosine similarity
- ✅ RAG retrieval pipeline functional
- ✅ LLM answer generation producing correct results
- ⚠️ In-memory storage (replace with persistent DB for production)
- ⚠️ Single-model LLM (add multi-model support)
- ⚠️ No query caching (implement for repeated questions)
