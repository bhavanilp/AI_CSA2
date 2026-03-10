# Component Specifications
## AI Customer Support Agent

---

## 1. Chat Widget Component Spec

### Interface
```typescript
// Initialize widget on page
window.AICSAWidget = {
  init(config: WidgetConfig): void;
  setUser(userId: string, userEmail?: string): void;
  open(): void;
  close(): void;
  sendMessage(message: string): void;
  destroy(): void;
}

interface WidgetConfig {
  apiEndpoint: string;           // Backend API base URL
  organizationId: string;        // Organization identifier
  theme: {
    primaryColor: string;        // e.g., "#007bff"
    secondaryColor: string;      // e.g., "#6c757d"
    logoUrl?: string;           // Company logo
    welcomeMessage?: string;    // Initial greeting
    placeholder?: string;       // Input placeholder
  };
  position: "bottom-right" | "bottom-left" | "top-right"; // Widget position
  maxHeight?: number;          // Max height in px
  zIndex?: number;             // CSS z-index
  onEscalate?: (data: EscalationData) => void;  // Callback on escalation
}

interface EscalationData {
  conversationId: string;
  transcript: Message[];
  reason: string;
  userEmail?: string;
  userName?: string;
}
```

### Usage Example
```html
<script>
  window.AICSAWidget.init({
    apiEndpoint: 'https://api.example.com',
    organizationId: 'org_abc123',
    theme: {
      primaryColor: '#007bff',
      logoUrl: 'https://example.com/logo.png',
      welcomeMessage: 'Hi! How can we help?'
    },
    position: 'bottom-right'
  });
</script>
```

### Key Features
- **Responsive design:** Mobile-first, adapts to screen size
- **Accessibility:** ARIA labels, keyboard navigation
- **Persistence:** Stores session ID in localStorage
- **Message history:** Shows last 20 messages in session
- **Typing indicator:** Shows when bot is thinking
- **Error fallback:** Graceful degradation if API unavailable
- **Throttling:** Prevents rapid message spam

### Styling Variables (CSS Custom Properties)
```css
--aicsa-primary-color: #007bff;
--aicsa-secondary-color: #6c757d;
--aicsa-text-color: #333;
--aicsa-bg-color: #fff;
--aicsa-border-color: #ddd;
--aicsa-border-radius: 8px;
--aicsa-shadow: 0 2px 8px rgba(0,0,0,0.1);
```

---

## 2. Backend API Specification

### Authentication
```
All endpoints (except /health) require JWT token in Authorization header:
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Chat Endpoints

**POST /api/chat/message**
```json
Request:
{
  "conversation_id": "conv_abc123",
  "message": "How do I reset my password?",
  "session_id": "sess_xyz789"
}

Response (200):
{
  "conversation_id": "conv_abc123",
  "message_id": "msg_123",
  "role": "bot",
  "content": "To reset your password, click the 'Forgot Password' link...",
  "confidence": 0.95,
  "sources": [
    {
      "source_id": "src_1",
      "name": "Help Center - Account",
      "url": "https://example.com/help/account"
    }
  ],
  "suggestions": ["password reset", "account recovery"],
  "escalation_needed": false,
  "timestamp": "2026-03-09T10:23:00Z"
}

Response (422 - Low confidence / escalation):
{
  "conversation_id": "conv_abc123",
  "escalation_needed": true,
  "escalation_reason": "confidence_low",
  "message": "I'm not sure about that. Would you like to speak with a human agent?",
  "timestamp": "2026-03-09T10:24:00Z"
}
```

**POST /api/chat/escalate**
```json
Request:
{
  "conversation_id": "conv_abc123",
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "message": "This is urgent please"
}

Response (200):
{
  "escalation_id": "esc_123",
  "status": "ticket_created",
  "message": "Thank you! A support agent will contact you shortly.",
  "ticket_reference": "SUP-2026-001234",
  "estimated_response_time": "30 minutes"
}
```

**GET /api/chat/conversation/:id**
```json
Response (200):
{
  "conversation_id": "conv_abc123",
  "messages": [
    {
      "message_id": "msg_1",
      "role": "user",
      "content": "How do I reset my password?",
      "timestamp": "2026-03-09T10:23:00Z"
    },
    {
      "message_id": "msg_2",
      "role": "bot",
      "content": "To reset your password...",
      "sources": [...],
      "timestamp": "2026-03-09T10:23:05Z"
    }
  ],
  "created_at": "2026-03-09T10:23:00Z",
  "last_message_at": "2026-03-09T10:24:30Z"
}
```

#### Admin Endpoints

**POST /api/admin/sources**
```json
Request:
{
  "source_type": "website" | "pdf" | "faq",
  "name": "FAQ Documentation",
  "config": {
    "urls": ["https://example.com/faq"],
    "crawl_depth": 2
  }
}

Response (201):
{
  "source_id": "src_123",
  "name": "FAQ Documentation",
  "status": "indexing",
  "created_at": "2026-03-09T10:00:00Z"
}
```

**GET /api/admin/sources**
```json
Response (200):
{
  "sources": [
    {
      "source_id": "src_1",
      "name": "Help Center",
      "source_type": "website",
      "status": "indexed",
      "chunk_count": 245,
      "last_indexed": "2026-03-09T08:00:00Z"
    }
  ],
  "total": 1
}
```

**POST /api/admin/sources/:id/reindex**
```json
Response (200):
{
  "source_id": "src_123",
  "status": "indexing",
  "message": "Reindexing started"
}
```

**DELETE /api/admin/sources/:id**
```
Response (204): No content
```

**GET /api/admin/conversations**
```json
Request Query Params:
  ?start_date=2026-03-01&end_date=2026-03-09&keyword=password&limit=50&offset=0

Response (200):
{
  "conversations": [
    {
      "conversation_id": "conv_1",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "message_count": 3,
      "was_escalated": false,
      "feedback_rating": 5,
      "created_at": "2026-03-09T10:00:00Z"
    }
  ],
  "total": 156,
  "offset": 0,
  "limit": 50
}
```

**POST /api/admin/conversations/:id/feedback**
```json
Request:
{
  "rating": 5,  // 1-5 or null
  "is_correct": true,
  "comment": "Answer was accurate and helpful"
}

Response (200):
{
  "conversation_id": "conv_123",
  "feedback_recorded": true
}
```

**GET /api/admin/metrics**
```json
Response (200):
{
  "date_range": {
    "start": "2026-03-01",
    "end": "2026-03-09"
  },
  "stats": {
    "total_conversations": 1543,
    "avg_response_time_ms": 1250,
    "escalation_rate": 0.18,
    "avg_satisfaction": 4.6,
    "unique_users": 892
  },
  "top_questions": [
    {
      "question": "How do I reset my password?",
      "count": 89,
      "avg_confidence": 0.92
    }
  ]
}
```

**GET /api/admin/escalation-rules**
```json
Response (200):
{
  "rules": [
    {
      "rule_id": "rule_1",
      "rule_type": "failed_attempts",
      "config": { "attempts": 2 },
      "enabled": true
    },
    {
      "rule_id": "rule_2",
      "rule_type": "keyword",
      "config": { "keywords": ["refund", "legal", "cancel"] },
      "enabled": true
    }
  ]
}
```

**PUT /api/admin/escalation-rules/:id**
```json
Request:
{
  "enabled": true,
  "escalation_email": "support@example.com"
}

Response (200):
{
  "rule_id": "rule_1",
  "updated_at": "2026-03-09T10:30:00Z"
}
```

#### Auth Endpoints

**POST /api/auth/login**
```json
Request:
{
  "email": "admin@example.com",
  "password": "securepassword"
}

Response (200):
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 900,
  "user": {
    "user_id": "user_123",
    "email": "admin@example.com",
    "role": "admin"
  }
}

Response (401):
{
  "error": "invalid_credentials"
}
```

**POST /api/auth/refresh**
```json
Request:
{
  "refresh_token": "eyJhbGc..."
}

Response (200):
{
  "access_token": "eyJhbGc...",
  "expires_in": 900
}
```

**POST /api/auth/logout**
```
Response (204): No content
```

#### Health Check

**GET /api/health**
```json
Response (200):
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-09T10:30:00Z",
  "dependencies": {
    "database": "ok",
    "vector_db": "ok",
    "llm_provider": "ok"
  }
}
```

---

## 3. Chat Orchestrator Specification

### Input / Output

**Input:**
```typescript
interface ChatRequest {
  conversationId: string;
  userId: string;
  message: string;
  sessionContext?: {
    previousMessages: Message[];
    pageUrl?: string;
    userAgent?: string;
  };
}

interface Message {
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  sources?: Source[];
}
```

**Output:**
```typescript
interface ChatResponse {
  conversationId: string;
  messageId: string;
  role: "bot";
  content: string;
  confidence: number;  // 0.0 - 1.0
  sources: Source[];
  shouldEscalate: boolean;
  escalationReason?: string;
}

interface Source {
  sourceId: string;
  name: string;
  url?: string;
  chunkText?: string;
  relevanceScore: number;
}
```

### Retrieval Process

```
1. Embed user query using embedding model
2. Vector DB search: retrieve top-k (k=5-10) chunks by similarity
3. Filter by metadata (optional: only from certain sources)
4. Re-rank retrieved chunks (optional: use cross-encoder)
5. Construct context: concatenate top 3-5 chunks
6. Check total token count (don't exceed context window)
```

### Prompt Engineering

**System Prompt Template:**
```
You are a helpful customer support AI assistant for [Company Name].
You answer questions based ONLY on the provided context below.
If you don't know the answer, say "I'm not sure about that" and suggest escalation.

Important:
- Be concise and accurate
- Cite sources when possible
- Never make up information
- Be friendly and professional

Context:
{RETRIEVED_CHUNKS_HERE}

User Query:
{USER_QUERY_HERE}

Answer:
```

**Confidence Scoring Logic:**
```
confidence_score = (
  retrieval_score (0-1) * 0.4 +
  semantic_similarity (0-1) * 0.3 +
  token_presence (0-1) * 0.2 +
  length_ratio (0-1) * 0.1
)

if confidence_score < 0.6:
  escalate = True
```

### Escalation Triggers

```typescript
interface EscalationTrigger {
  type: "confidence_low" | "keywords" | "user_request" | "failed_attempts";
  data: {
    confidenceScore?: number;
    keywords?: string[];
    attemptCount?: number;
  };
}

// Logic:
if (confidenceScore < THRESHOLD) {  // e.g., 0.6
  trigger("confidence_low");
} else if (detectKeywords(message, ESCALATION_KEYWORDS)) {  // ["refund", "legal", "cancel"]
  trigger("keywords");
} else if (consecutiveFailedAnswers >= MAX_ATTEMPTS) {  // e.g., 2
  trigger("failed_attempts");
} else if (message.includes("speak with human") || "agent" || "support") {
  trigger("user_request");
}
```

---

## 4. Document Ingestion Pipeline Specification

### Ingestion Process

**Step 1: Source Configuration**
```typescript
interface SourceConfig {
  sourceId: string;
  sourceType: "website" | "pdf" | "faq";
  config: {
    // For websites
    urls?: string[];
    sitemap?: string;
    crawlDepth?: number;
    excludePatterns?: string[];  // regex patterns to skip
    
    // For files
    fileIds?: string[];  // uploaded file references
  };
}
```

**Step 2: Content Fetching**
```
For websites:
  - Fetch sitemap.xml if provided
  - Crawl URLs with depth limit
  - Parse HTML, extract text
  - Respect robots.txt and user-agent
  
For PDFs:
  - Extract text (handle OCR if needed)
  - Preserve structure (headings, lists)
  
For FAQs:
  - Parse CSV, Markdown, or JSON
  - Map Q/A pairs
```

**Step 3: Chunking**
```
Strategy: Semantic chunking with overlap

Options:
1. Fixed size: 1000 tokens, 200 token overlap
2. Semantic: Split on sentence/paragraph boundaries, ~1000 tokens
3. Recursive: Split on markdown headers, then paragraphs

Selected: Semantic with 1000-token target

Output:
[
  {
    chunkId: "chunk_1",
    text: "...",
    tokens: 950,
    metadata: {
      sourceId: "src_1",
      sourceName: "FAQ",
      sourceUrl: "...",
      section: "Payment",
      chunkIndex: 0
    }
  },
  ...
]
```

**Step 4: Embedding Generation**
```
Model: text-embedding-3-small (OpenAI)
Dimension: 1536
Batch size: 100 (for API efficiency)

Input: Chunk text
Output: Dense vector [1536 dimensions]
```

**Step 5: Storage in Vector DB**
```
Insert into vector DB:
{
  id: "chunk_1_src_1",
  embedding: [0.1, 0.2, ...],
  metadata: {
    chunk_text: "...",
    source_id: "src_1",
    source_name: "FAQ",
    section: "Payment",
    chunk_index: 0,
    created_at: "2026-03-09T10:00:00Z"
  }
}
```

### Error Handling

```
Retriable errors (with backoff):
- Network timeout
- Rate limit (429)
- Temporary service unavailable (503)

Non-retriable errors:
- Invalid URL (404, 403)
- Invalid file format
- Authentication required
- Malformed content

Logging:
- Track success/failure per chunk
- Log error details
- Notify admin of failed sources
```

### Re-indexing Logic

```
Trigger re-indexing when:
1. Admin manually requests via dashboard
2. Source config changes (URLs added/removed)
3. Scheduled daily refresh (optional)

Process:
1. Fetch fresh content
2. Identify new/modified chunks
3. Delete old embeddings for source
4. Insert new embeddings
5. Update source status and timestamp
```

---

## 5. Admin Dashboard Specification

### Page Structure

```
/admin/dashboard
  ├─ Header (Logo, User, Logout)
  ├─ Sidebar (Navigation)
  │  ├─ Sources
  │  ├─ Conversations
  │  ├─ Analytics
  │  ├─ Escalation Rules
  │  └─ Settings
  └─ Main Content Area

/admin/sources
  ├─ List of sources (table)
  │  ├─ Source name
  │  ├─ Type (website/PDF/FAQ)
  │  ├─ Status (indexed/indexing/failed)
  │  ├─ Chunk count
  │  ├─ Last indexed
  │  └─ Actions (edit, reindex, delete)
  └─ Add Source (modal/form)
     ├─ Upload file
     └─ OR specify URL/sitemap

/admin/conversations
  ├─ Filter bar
  │  ├─ Date range
  │  ├─ Keyword search
  │  └─ Status (escalated/resolved/pending)
  ├─ Conversation list (paginated)
  │  ├─ User name, email
  │  ├─ Summary of query
  │  ├─ Message count
  │  ├─ Rating (if provided)
  │  └─ Escalated? (Y/N)
  └─ Conversation detail (side panel)
     ├─ Full transcript
     ├─ Sources referenced
     ├─ Feedback form (rate, flag incorrect)
     └─ Escalation info (if applicable)

/admin/analytics
  ├─ Date range picker
  ├─ Key metrics (cards)
  │  ├─ Total conversations
  │  ├─ Avg response time
  │  ├─ Escalation rate
  │  └─ Avg satisfaction
  ├─ Trend charts (line/bar)
  │  ├─ Conversations over time
  │  ├─ Escalation rate trend
  │  └─ Top questions
  └─ Export button (CSV)

/admin/escalation-rules
  ├─ List of rules
  │  ├─ Rule type (failed attempts / keywords / confidence)
  │  ├─ Configuration
  │  ├─ Escalation email
  │  ├─ Enabled toggle
  │  └─ Actions (edit, delete)
  └─ Add Rule (modal/form)

/admin/settings
  ├─ Organization info
  ├─ Chat widget configuration
  │  ├─ Primary color, logo, welcome message
  │  └─ Snippet to embed
  ├─ API keys (masked)
  ├─ Backup & restore
  └─ Danger zone (delete account)
```

### UI Components (Reusable)

```
Button
├─ Variants: primary, secondary, danger
├─ Sizes: small, medium, large
└─ States: default, loading, disabled

Table
├─ Sortable columns
├─ Pagination
├─ Row selection (checkboxes)
└─ Actions dropdown

Modal
├─ Header, body, footer
└─ Close button

Form
├─ Input, Textarea, Select, Checkbox
├─ Validation messages
└─ Submit button

Card
├─ Title, content, footer
└─ Shadow/border styling

Badge
├─ Status: indexed, indexing, failed, pending
└─ Color-coded

Alert
├─ Info, success, warning, error variants
└─ Dismissible option
```

---

## 6. Configuration & Environment Variables

### Backend Configuration

```bash
# API & Server
BACKEND_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://example.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aicsa_db
DB_POOL_SIZE=20

# Vector Database
VECTOR_DB_TYPE=pinecone|weaviate|qdrant
PINECONE_API_KEY=xxx
PINECONE_ENVIRONMENT=us-west-2
PINECONE_INDEX_NAME=aicsa-index

# LLM Provider
LLM_PROVIDER=openai|anthropic|azure
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo
EMBEDDING_MODEL=text-embedding-3-small

# Authentication
JWT_SECRET=long_random_string
JWT_EXPIRY=900  # 15 minutes in seconds
REFRESH_TOKEN_EXPIRY=604800  # 7 days

# Email / Escalation
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=app_password
ESCALATION_EMAIL=support@example.com

# RAG Configuration
RETRIEVAL_TOP_K=5
CONFIDENCE_THRESHOLD=0.6
MAX_CONTEXT_TOKENS=2000

# Monitoring
SENTRY_DSN=https://...
DATADOG_API_KEY=xxx
```

### Frontend Configuration

```javascript
// .env.local (for development)
REACT_APP_API_ENDPOINT=http://localhost:3000
REACT_APP_ORGANIZATION_ID=org_test

// In production, embed widget configuration in script tag
<script>
  window.AICSAConfig = {
    apiEndpoint: 'https://api.example.com',
    organizationId: 'org_prod_123'
  }
</script>
```

---

## 7. Error Handling & Resilience

### Common Error Scenarios

| Scenario | Status Code | User Message |
|----------|-------------|--------------|
| LLM API timeout | 504 | "Service busy, please try again" |
| Vector DB unavailable | 503 | "Search unavailable, escalating to human" |
| User not authenticated | 401 | "Please log in again" |
| Invalid file upload | 400 | "Invalid file format" |
| Rate limit exceeded | 429 | "Too many requests, please wait" |
| Server error | 500 | "An error occurred, please contact support" |

### Retry Logic

```
Implement exponential backoff for external API calls:
  Attempt 1: immediate
  Attempt 2: after 1 second
  Attempt 3: after 3 seconds
  Attempt 4: after 7 seconds
  Max: 4 attempts
```

### Fallback Behaviors

```
If LLM unavailable:
  → Show: "I'm temporarily unavailable. Would you like to escalate?"
  
If Vector DB search fails:
  → Try: Search by keyword in metadata only
  → Or: Offer escalation
  
If embedding generation fails:
  → Retry with smaller text chunk
  → Or: Skip and log error
```

