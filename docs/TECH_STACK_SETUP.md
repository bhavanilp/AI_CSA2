# Tech Stack & Development Setup
## AI Customer Support Agent

---

## 1. Recommended Tech Stack

### Backend

| Layer | Options | Recommended |
|-------|---------|-------------|
| **Framework** | Node.js/Express, Python/FastAPI, Java/Spring, Go/Gin | Node.js/Express (fast iteration) or Python/FastAPI (ML-friendly) |
| **Language** | TypeScript, Python, Java, Go | TypeScript (for type safety) |
| **Database** | PostgreSQL, MongoDB | PostgreSQL (structured data, ACID) |
| **Vector DB** | Pinecone, Weaviate, Qdrant, Chroma | Pinecone (managed, scalable) |
| **Job Queue** | Bull (Node), Celery (Python), RQ | Bull (Node) or Celery (Python) |
| **Cache** | Redis | Redis (session cache, rate limiting) |
| **API Client** | Axios, Fetch, Requests | Axios (Node) or Requests (Python) |
| **Logging** | Winston, Pino, structlog | Winston (Node) or structlog (Python) |
| **Testing** | Jest, Pytest, Mocha | Jest (Node) or Pytest (Python) |

### Frontend

| Component | Options | Recommended |
|-----------|---------|-------------|
| **Chat Widget** | React, Vue, Vanilla JS | React (ecosystem, components) |
| **Admin Dashboard** | React, Next.js, Vue | Next.js (full-stack, SSR) |
| **UI Library** | Material-UI, Tailwind, Bootstrap | Tailwind CSS (lightweight, flexible) |
| **State Management** | Redux, Zustand, Context API | Zustand (lightweight) or Context API (simple) |
| **HTTP Client** | Axios, Fetch | Axios (better defaults) |
| **Build Tool** | Webpack, Vite | Vite (fast dev experience) |
| **Testing** | Jest, Vitest | Vitest (fast, Vite-integrated) |

### LLM & Embeddings

| Service | Options | Recommended |
|---------|---------|-------------|
| **LLM** | OpenAI (GPT-4/4-Mini), Anthropic (Claude), Azure, Google | OpenAI GPT-4 Mini (cost-effective) |
| **Embeddings** | OpenAI (text-embedding-3-small), Hugging Face | OpenAI text-embedding-3-small (reliable, fast) |
| **LLM Client Library** | LangChain, LlamaIndex | LangChain (popular, well-supported) |

### Deployment & DevOps

| Tool | Purpose | Recommended |
|------|---------|-------------|
| **Container** | Docker | Docker |
| **Orchestration** | Kubernetes, Docker Compose | Kubernetes (production) or Docker Compose (MVP) |
| **Cloud Platform** | AWS, GCP, Azure, Heroku | AWS (EC2, RDS, Lambda) or Vercel (frontend) |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins | GitHub Actions (free for public repos) |
| **Monitoring** | Datadog, New Relic, CloudWatch | CloudWatch (AWS) or Datadog (comprehensive) |
| **Logging** | CloudWatch, Loggly, ELK | CloudWatch (AWS integration) |

---

## 2. Repository Structure

```
ai-customer-support-agent/
├── backend/                    # Node.js/Express or Python/FastAPI
│   ├── src/
│   │   ├── api/               # API routes & controllers
│   │   │   ├── chat.ts
│   │   │   ├── admin.ts
│   │   │   ├── auth.ts
│   │   │   └── health.ts
│   │   ├── services/          # Business logic
│   │   │   ├── chatOrchestrator.ts
│   │   │   ├── documentIngestion.ts
│   │   │   ├── escalationService.ts
│   │   │   └── authService.ts
│   │   ├── models/            # Data models
│   │   │   ├── Conversation.ts
│   │   │   ├── Source.ts
│   │   │   └── User.ts
│   │   ├── config/            # Configuration
│   │   │   ├── database.ts
│   │   │   ├── llm.ts
│   │   │   └── vectorDb.ts
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── validation.ts
│   │   ├── utils/             # Utilities
│   │   │   ├── logger.ts
│   │   │   ├── prompt.ts
│   │   │   └── chunking.ts
│   │   └── index.ts           # App entry point
│   ├── .env.example           # Environment variables template
│   ├── package.json
│   ├── tsconfig.json          # TypeScript config
│   ├── Dockerfile
│   └── tests/                 # Unit & integration tests
│       ├── unit/
│       └── integration/
│
├── frontend/
│   ├── chat-widget/           # Embeddable chat widget
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── InputForm.tsx
│   │   │   │   └── EscalationModal.tsx
│   │   │   ├── services/
│   │   │   │   └── api.ts
│   │   │   ├── hooks/
│   │   │   │   └── useChat.ts
│   │   │   ├── styles/
│   │   │   │   └── widget.css
│   │   │   └── index.ts       # Widget entry point
│   │   ├── dist/              # Built widget bundle
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── admin-dashboard/       # Next.js admin panel
│       ├── app/               # Next.js app router
│       │   ├── (auth)/
│       │   │   └── login/page.tsx
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── sources/page.tsx
│       │   │   ├── conversations/page.tsx
│       │   │   ├── analytics/page.tsx
│       │   │   ├── escalation-rules/page.tsx
│       │   │   └── settings/page.tsx
│       │   └── api/           # API routes
│       ├── components/        # Shared components
│       ├── lib/               # Utilities
│       ├── public/
│       ├── package.json
│       ├── next.config.js
│       └── tailwind.config.js
│
├── ingestion/                 # Async document ingestion service (optional)
│   ├── src/
│   │   ├── workers/
│   │   │   ├── websiteCrawler.ts
│   │   │   ├── pdfParser.ts
│   │   │   └── embeddingGenerator.ts
│   │   ├── queue.ts           # Job queue setup
│   │   └── index.ts
│   └── package.json
│
├── docs/
│   ├── PRD.md                 # Product requirements
│   ├── COMPONENT_SPECS.md    # Detailed specs
│   ├── API.md                 # API documentation
│   └── SETUP.md               # This file
│
├── architecture/
│   ├── ARCHITECTURE.md        # System design
│   ├── diagrams/              # ASCII/Mermaid diagrams
│   └── data-model.md          # Database schema
│
├── scripts/
│   ├── setup-db.sql           # Database initialization
│   ├── seed-data.ts           # Sample data
│   └── deploy.sh              # Deployment script
│
├── docker-compose.yml         # Local development setup
├── .github/
│   └── workflows/
│       ├── test.yml           # Run tests on PR
│       ├── build.yml          # Build on merge
│       └── deploy.yml         # Deploy to production
├── .gitignore
├── README.md
└── LICENSE
```

---

## 3. Environment Variables

### Backend (.env)

```bash
# App Configuration
NODE_ENV=development
BACKEND_PORT=3000
BACKEND_URL=http://localhost:3000
LOG_LEVEL=debug

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/aicsa_db
DB_POOL_SIZE=20
DB_TIMEOUT=5000

# Vector Database (Pinecone)
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=your_api_key
PINECONE_ENVIRONMENT=us-west-2
PINECONE_INDEX_NAME=aicsa-prod

# LLM Provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your_api_key
OPENAI_MODEL=gpt-4-turbo
EMBEDDING_MODEL=text-embedding-3-small

# Authentication
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars
JWT_EXPIRY=900
REFRESH_TOKEN_EXPIRY=604800

# Email / SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@company.com
SMTP_PASS=your_app_password
ESCALATION_EMAIL=support@company.com

# Cache (Redis)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
SESSION_SECRET=your_session_secret

# RAG Configuration
RETRIEVAL_TOP_K=5
CONFIDENCE_THRESHOLD=0.6
MAX_CONTEXT_TOKENS=2000
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# External Services
SENTRY_DSN=
DATADOG_API_KEY=

# CORS
CORS_ORIGIN=http://localhost:3001,https://example.com

# File Upload
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=./uploads
```

### Frontend (.env.local for dev, .env.production for prod)

```bash
REACT_APP_API_ENDPOINT=http://localhost:3000
REACT_APP_ORG_ID=org_test_123
REACT_APP_WIDGET_VERSION=1.0.0
```

---

## 4. Local Development Setup

### Prerequisites

```bash
# Required
Node.js 18+ (or Python 3.9+)
npm or yarn
PostgreSQL 13+
Redis 7+
Docker (for services)
Git

# Optional
Docker & Docker Compose
VS Code with extensions: ESLint, Prettier, Thunder Client
```

### Quick Start

#### 1. Clone Repository

```bash
git clone https://github.com/yourorg/ai-customer-support-agent.git
cd ai-customer-support-agent
```

#### 2. Backend Setup (Node.js)

```bash
cd backend
cp .env.example .env

# Install dependencies
npm install

# Start PostgreSQL & Redis with Docker Compose
docker-compose up -d postgres redis

# Initialize database
npm run db:migrate
npm run db:seed

# Start backend server
npm run dev

# Backend running at http://localhost:3000
```

#### 3. Frontend Setup (Chat Widget)

```bash
cd frontend/chat-widget
npm install
npm run dev

# Built to dist/ folder
npm run build

# Output: dist/aicsa-widget.js (can be embedded)
```

#### 4. Admin Dashboard Setup (Next.js)

```bash
cd frontend/admin-dashboard
npm install
npm run dev

# Admin dashboard running at http://localhost:3001
# Login: admin@example.com / password
```

#### 5. Test Everything

```bash
# Backend tests
cd backend
npm run test
npm run test:integration

# Frontend tests
cd frontend/admin-dashboard
npm run test
```

### Docker Compose Setup

```bash
# Start all services (backend, postgres, redis, frontend)
docker-compose up

# View logs
docker-compose logs -f backend

# Stop
docker-compose down

# Rebuild
docker-compose up --build
```

**docker-compose.yml:**
```yaml
version: '3.9'
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/aicsa_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=aicsa_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  admin:
    build: ./frontend/admin-dashboard
    ports:
      - "3001:3000"
    depends_on:
      - backend
    environment:
      - NEXT_PUBLIC_API_ENDPOINT=http://localhost:3000

volumes:
  postgres_data:
```

---

## 5. Database Schema (PostgreSQL)

### Key Tables

```sql
-- Users (admin users)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer',  -- 'admin' or 'viewer'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Sources
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50),  -- 'website', 'pdf', 'faq'
  config JSONB,  -- Stores URLs, file refs, etc.
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'indexing', 'indexed', 'failed'
  chunk_count INT DEFAULT 0,
  last_indexed TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  messages JSONB,  -- Array of {role, content, timestamp, sources}
  was_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason VARCHAR(255),
  escalation_id UUID,
  feedback_rating INT,  -- 1-5
  is_correct BOOLEAN,
  feedback_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Escalation Rules
CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rule_type VARCHAR(50),  -- 'failed_attempts', 'keyword', 'confidence'
  config JSONB,  -- { attempts: 2 } or { keywords: [...] } or { threshold: 0.6 }
  escalation_email VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Escalations (created when escalation is triggered)
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  reason VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',  -- 'open', 'in_progress', 'resolved'
  ticket_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

---

## 6. CI/CD Pipeline

### GitHub Actions Workflow (.github/workflows/test.yml)

```yaml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: aicsa_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: 'backend/package-lock.json'
    
    - name: Install dependencies
      working-directory: ./backend
      run: npm ci
    
    - name: Run tests
      working-directory: ./backend
      run: npm test
      env:
        DATABASE_URL: postgresql://postgres:password@localhost:5432/aicsa_test

  frontend-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: 'frontend/**/package-lock.json'
    
    - name: Install & test widget
      working-directory: ./frontend/chat-widget
      run: npm ci && npm test
    
    - name: Install & test admin
      working-directory: ./frontend/admin-dashboard
      run: npm ci && npm test
```

---

## 7. Deployment Guide

### Deploy Backend (to AWS EC2 or Heroku)

#### Option A: Docker to AWS ECR + ECS

```bash
# Build Docker image
docker build -t aicsa-backend:latest ./backend

# Tag for ECR
docker tag aicsa-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/aicsa-backend:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/aicsa-backend:latest

# Update ECS task definition and service
# (Use AWS Console or CLI)
```

#### Option B: Deploy to Heroku

```bash
heroku create aicsa-backend
heroku addons:create heroku-postgresql:standard-0
heroku addons:create heroku-redis:premium-0

# Set environment variables
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set PINECONE_API_KEY=...

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Deploy Frontend (to Vercel or Netlify)

#### Chat Widget: Publish to CDN

```bash
cd frontend/chat-widget
npm run build

# Upload dist/ to CDN (e.g., AWS S3 + CloudFront)
aws s3 cp dist/ s3://your-bucket/aicsa-widget/v1.0.0/ --recursive
```

#### Admin Dashboard: Deploy to Vercel

```bash
cd frontend/admin-dashboard
vercel --prod

# Or connect GitHub repo to Vercel for automatic deployments
```

---

## 8. Monitoring & Logging

### Application Monitoring

```bash
# Install Datadog agent
npm install @datadog/browser-rum @datadog/browser-logs

# Or use CloudWatch for AWS
npm install aws-sdk
```

### Log Aggregation

**Backend logging setup (Winston):**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

export default logger;
```

### Key Metrics to Monitor

- API response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database query time
- Vector DB search latency
- LLM API latency
- Escalation rate
- User satisfaction scores

---

## 9. Security Best Practices

- ✅ **HTTPS everywhere** – All traffic encrypted (TLS 1.3+)
- ✅ **API authentication** – JWT tokens with short expiry
- ✅ **Database encryption** – Use encrypted RDS instances
- ✅ **Secrets management** – AWS Secrets Manager or Vault
- ✅ **CORS** – Whitelist trusted origins
- ✅ **Rate limiting** – Prevent brute force / DDoS
- ✅ **Input validation** – Sanitize all user inputs
- ✅ **CSRF protection** – SameSite cookies
- ✅ **Dependency scanning** – Regular security audits
- ✅ **Data privacy** – Comply with GDPR/CCPA (no training on user data without consent)

---

## 10. Getting Help

- **Documentation:** `/docs` folder
- **API Reference:** Swagger UI at `http://localhost:3000/api/docs`
- **Issues & Discussions:** GitHub Issues
- **Contact:** team@example.com

---
