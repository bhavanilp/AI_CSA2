# System Architecture Documentation
## AI Customer Support Agent

---

## Architecture Diagram

```
                    +-----------------------------+
                    |        End User (Web)       |
                    |  Browser with Chat Widget   |
                    +--------------+--------------+
                                   |
                                   v
                        HTTPS / REST / WebSocket
                                   |
                     +-------------+-------------+
                     |      API Gateway /        |
                     |    Backend Web Server     |
                     +-------------+-------------+
                                   |
        +--------------------------+---------------------------+
        |                          |                           |
        v                          v                           v
+---------------+        +-------------------+        +------------------+
|  Chat / RAG   |        |  Admin Dashboard  |        |  Auth Service    |
|  Orchestrator |        |  (Web UI + API)   |        |  (Users, Roles)  |
+-------+-------+        +---------+---------+        +------------------+
        |                          |
        |                          v
        |                 +-------------------+
        |                 |  Admin Database   |
        |                 | (Configs, Logs,   |
        |                 |  Users, Rules)    |
        |                 +-------------------+
        |
        v
+------------------+       +------------------------+       +------------------+
|  Vector Database |<----->|  Document Ingestion    |<----->|  Content Sources |
| (Embeddings)     |       |  Pipeline              |       | (Web, PDFs, FAQ) |
+------------------+       +------------------------+       +------------------+
        |
        v
+------------------+       +------------------------+
|   LLM Provider   |<----->|  RAG Orchestrator      |
| (External API)   |       | (Prompt + Context)     |
+------------------+       +------------------------+
        |
        v
+------------------+
|  Email / Ticket  |
|  Escalation      |
+------------------+
```

---

## Component Breakdown

### 1. Chat Widget (Frontend)
**Responsibility:** Client-side interface for end users

**Key Features:**
- Embeddable via JavaScript snippet (iframe or custom element)
- Real-time message display with typing indicators
- Session management and message history
- Responsive design (desktop, tablet, mobile)
- Configurable theming (colors, logo, welcome message)
- Graceful fallback if backend unavailable

**Technology Stack:**
- React, Vue.js, or vanilla JavaScript
- WebSocket or REST for communication
- Local storage for session persistence
- CSS/SCSS for styling and theming

**Interactions:**
- Sends user queries to API Gateway
- Receives answers and escalation prompts from backend
- Manages UI state and conversation context

---

### 2. API Gateway / Backend Web Server
**Responsibility:** Central entry point for all requests

**Key Responsibilities:**
- HTTP/HTTPS request handling
- Request authentication and validation
- Route requests to appropriate services
- Session management (JWT tokens)
- Rate limiting and DDoS protection
- CORS handling for widget embedding

**Technology Stack:**
- Node.js/Express, Python/FastAPI, Java/Spring, or Go
- JWT for token-based authentication
- Middleware for logging, error handling, security

**Endpoints:**
- `POST /api/chat` – Send user message, get answer
- `POST /api/escalate` – Escalate to human agent
- `GET/POST /api/admin/*` – Admin dashboard APIs
- `POST /api/auth/login` – User authentication

---

### 3. Chat / RAG Orchestrator
**Responsibility:** Core intelligence for question-answering

**Key Responsibilities:**
- Receive user query and conversation context
- Retrieve relevant document chunks from vector DB
- Construct RAG prompt with context
- Call LLM provider API
- Evaluate confidence and determine escalation need
- Return grounded answer with source references
- Handle multi-turn conversation context

**Workflow:**
1. User sends query
2. Retrieve embeddings from vector DB
3. Rank top-k relevant chunks
4. Build prompt: `[system] + [retrieved context] + [user query]`
5. Call LLM (OpenAI, Anthropic, etc.)
6. Post-process answer (confidence score, source reference)
7. Return to user or escalate if confidence too low

**Configuration:**
- LLM model (GPT-4, Claude, etc.)
- Temperature and max_tokens
- Confidence threshold
- Top-k retrieval count

**Technology Stack:**
- Python (LangChain, LlamaIndex) or JavaScript (LangChain.js)
- Vector database client library

---

### 4. Document Ingestion Pipeline
**Responsibility:** Process and index knowledge sources

**Key Responsibilities:**
- Crawl website URLs / fetch sitemap
- Parse PDFs, DOCX, TXT, CSV, Markdown
- Extract text and metadata
- Chunk content into semantic segments
- Generate embeddings for chunks
- Store in vector database
- Handle re-indexing on updates
- Error handling and retry logic

**Workflow:**
1. Admin specifies source (URL, file upload, or list)
2. Fetch/read content
3. Parse and extract text
4. Split into overlapping chunks
5. Generate embeddings via embedding model (e.g., `text-embedding-3-small`)
6. Store chunks + embeddings + metadata in vector DB
7. Log success/failure

**Technology Stack:**
- Python libraries: `requests`, `BeautifulSoup`, `pypdf`, `python-docx`
- LangChain or LlamaIndex for chunking/embedding management
- Async processing for scalability

---

### 5. Vector Database
**Responsibility:** Store and retrieve semantic embeddings

**Key Features:**
- Store document chunks + embeddings + metadata
- Semantic similarity search (cosine, L2, etc.)
- Metadata filtering (source, date, URL)
- Scalable to millions of chunks
- Real-time indexing

**Use Cases:**
- Fast retrieval of top-k similar chunks for a query
- Metadata-filtered search (e.g., "only from FAQ docs")

**Technology Options:**
- **Managed:** Pinecone, Weaviate Cloud, Qdrant Cloud
- **Self-hosted:** Weaviate, Qdrant, Milvus, Chroma
- **Hybrid:** OpenSearch with vector plugin

**Schema Example:**
```
{
  "id": "chunk_12345",
  "embedding": [0.1, 0.2, ..., 0.9],  // 1536 dimensions for text-embedding-3
  "text": "Refund policy: ...",
  "metadata": {
    "source_id": "policy_doc_1",
    "source_name": "Refund Policy",
    "source_url": "https://example.com/refund",
    "chunk_index": 3,
    "created_at": "2026-03-09T10:00:00Z"
  }
}
```

---

### 6. LLM Provider
**Responsibility:** Generate human-like text responses

**Integration Points:**
- RAG Orchestrator calls LLM API
- Pass prompt with context and user query
- Receive generated answer
- Handle rate limits and errors

**Configuration Options:**
- **Model:** GPT-4, GPT-4 Mini, Claude 3, Gemini, etc.
- **Temperature:** 0.0–1.0 (lower = deterministic)
- **Max tokens:** Output length limit
- **Stop sequences:** When to stop generation

**Provider Options:**
- OpenAI (GPT-4, GPT-4 Mini)
- Anthropic (Claude 3, Claude 3.5)
- Azure OpenAI
- Google Vertex AI (PaLM, Gemini)
- Meta / Llama 2 (self-hosted)

**Cost Optimization:**
- Use smaller models (e.g., GPT-4 Mini) for MVP
- Cache repeated queries
- Batch requests when possible

---

### 7. Admin Dashboard
**Responsibility:** Manage knowledge sources, view logs, configure system

**Key Modules:**

#### 7.1 Knowledge Source Management
- View list of all sources (URLs, files, FAQs)
- Upload new documents (drag-and-drop)
- Add website URLs or sitemap
- Trigger re-indexing
- Delete/disable sources
- View indexing status and error logs

#### 7.2 Conversation Logs & Analytics
- View recent conversations with filters (date, keyword, status)
- Search by user query or bot answer
- Rate answer quality (helpful/not helpful)
- Flag incorrect answers and provide feedback
- Export logs as CSV
- View metrics: conversation count, escalation rate, top questions

#### 7.3 Escalation Rules Configuration
- Set escalation triggers:
  - After N failed attempts
  - For specific keywords (e.g., "refund", "legal", "cancel")
  - When confidence score below threshold
- Configure escalation target email
- Set escalation message template

#### 7.4 System Settings
- Configure LLM model and parameters
- Set chat widget appearance (colors, logo, welcome message)
- API key management for external services
- Backup and restore data

**Technology Stack:**
- Frontend: React, Vue, or Next.js
- Backend APIs: Node.js/Express, Python/FastAPI, etc.
- Database: PostgreSQL or MongoDB for admin data

---

### 8. Admin Database
**Responsibility:** Persist admin data, configs, logs

**Key Tables/Collections:**

**sources** (knowledge sources)
```
{
  source_id: uuid,
  organization_id: uuid,
  source_type: "website" | "pdf" | "faq",
  name: string,
  config: {
    urls: string[],
    file_path?: string,
    crawl_depth?: number
  },
  status: "pending" | "indexing" | "indexed" | "failed",
  last_indexed: timestamp,
  error_message?: string,
  created_at: timestamp,
  updated_at: timestamp
}
```

**conversations** (chat logs)
```
{
  conversation_id: uuid,
  organization_id: uuid,
  user_session_id: string,
  messages: [
    {
      role: "user" | "bot",
      content: string,
      timestamp: timestamp,
      sources?: [{ source_id, source_name, url }]
    }
  ],
  was_escalated: boolean,
  escalation_reason?: string,
  user_email?: string,
  user_name?: string,
  feedback_rating?: 1-5,
  created_at: timestamp,
  updated_at: timestamp
}
```

**escalation_rules** (configuration)
```
{
  rule_id: uuid,
  organization_id: uuid,
  rule_type: "failed_attempts" | "keyword" | "confidence",
  config: {
    attempts?: number,
    keywords?: string[],
    threshold?: float
  },
  escalation_email: string,
  enabled: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

**admin_users** (access control)
```
{
  user_id: uuid,
  organization_id: uuid,
  email: string,
  password_hash: string,
  role: "admin" | "viewer",
  created_at: timestamp,
  last_login: timestamp
}
```

---

### 9. Auth Service
**Responsibility:** User authentication and authorization

**Features (MVP):**
- Username/password authentication
- JWT token generation and validation
- Session management
- Role-based access control (RBAC)

**Features (Future):**
- SSO (OAuth 2.0, SAML)
- Multi-factor authentication (MFA)

**Implementation:**
- JWT tokens with short expiry (15 min access, 7 days refresh)
- Secure password hashing (bcrypt, PBKDF2)
- HTTPS-only cookie transmission
- CSRF protection

---

### 10. Email / Ticket Escalation Service
**Responsibility:** Send escalation notifications to support team

**Workflow:**
1. Escalation triggered (user request or low confidence)
2. Collect user info (name, email, optional message)
3. Compile conversation transcript
4. Send email with all context:
   - User details
   - Full conversation history
   - Source references (if applicable)
   - Timestamp and page URL
   - Suggested response category

**Integration Options:**
- **SMTP:** Direct email via company email provider
- **Third-party API:** SendGrid, AWS SES, Mailgun
- **Ticketing system:** Create ticket in Zendesk, Freshdesk, Jira

**Email Template Example:**
```
Subject: Customer Support Escalation - Needs Human Agent

User: John Doe (john@customer.com)
Date: 2026-03-09 10:23 AM
Page: https://example.com/docs/api

Conversation:
-----------
Q: How do I integrate your API with Shopify?
A: [Bot answer] (Confidence: 65%)

Q: But what about custom payment methods?
A: I'm not sure about that. Let me connect you with a human agent.

User Message: This is urgent, I have a live shop deployment.
-----------

Suggested Category: Technical Integration
Status: Awaiting Response
```

---

## Data Flow Diagrams

### User Query → Answer Flow
```
1. User Types Query
   │
   ├─→ Chat Widget (Frontend)
   │   │
   │   └─→ API Gateway
   │       │
   │       ├─→ Chat/RAG Orchestrator
   │       │   │
   │       │   ├─→ Vector DB (Retrieve top-k chunks)
   │       │   │
   │       │   ├─→ LLM Provider (Generate answer)
   │       │   │
   │       │   └─→ Check confidence / escalation
   │       │
   │       └─→ Return answer or escalation prompt
   │
   └─→ Chat Widget displays response
```

### Knowledge Ingestion Flow
```
1. Admin Uploads/Specifies Source
   │
   ├─→ Admin Dashboard
   │   │
   │   └─→ Ingestion Service
   │       │
   │       ├─→ Fetch/Parse Content (Web, PDF, etc.)
   │       │
   │       ├─→ Chunk Text (semantic overlap)
   │       │
   │       ├─→ Generate Embeddings
   │       │
   │       ├─→ Store in Vector DB
   │       │
   │       └─→ Update Admin DB (source status: "indexed")
   │
   └─→ Admin notified (success/failure)
```

---

## Deployment Architecture (Conceptual)

```
Internet Users
      │
      v
   [CDN]  ← Chat widget JS
      │
      v
[Load Balancer]
      │
      ├───┬───┬───┐
      v   v   v   v
   [API Gateway / Backend Server] × N (Replicas)
   ├─ Express Server
   ├─ Auth middleware
   └─ Route to services
   
   ├──→ [Chat/RAG Orchestrator Service] × M (Replicas)
   │    ├─ Call Vector DB
   │    └─ Call LLM Provider
   │
   ├──→ [Ingestion Service] (Async queue)
   │    └─ Background job processor
   │
   ├──→ [Admin Dashboard Backend]
   │    └─ CRUD on Admin DB
   │
   └──→ [Vector Database] (Managed or self-hosted)
        └─ Pinecone, Weaviate, etc.

   External Services:
   ├─ [LLM Provider] (OpenAI, Anthropic, etc.)
   ├─ [Email Service] (SMTP, SendGrid, etc.)
   └─ [Logging/Monitoring] (CloudWatch, Datadog, etc.)
```

---

## Scaling Considerations

- **Horizontal scaling:** Multiple API server replicas behind load balancer
- **Caching:** Redis for session cache and frequent queries
- **Async processing:** Queue (Bull, Celery) for ingestion jobs
- **Database indexing:** Proper indexing on conversation logs and sources
- **Vector DB optimization:** Batching embeddings, partitioning by organization
- **Rate limiting:** Per-user and per-organization limits
- **Monitoring & observability:** Logs, metrics, traces (e.g., OpenTelemetry)
