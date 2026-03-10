# AI Customer Support Agent - Complete Codebase

This repository contains the complete implementation of the AI Customer Support Agent - a production-ready RAG chatbot system.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL 13+
- Redis 7+
- Docker & Docker Compose (optional)

### 1. Clone & Setup

```bash
# Clone repository
git clone https://github.com/yourorg/ai-customer-support-agent.git
cd ai-customer-support-agent

# Copy example env
cp backend/.env.example backend/.env

# Edit backend/.env with your API keys:
# - OPENAI_API_KEY
# - PINECONE_API_KEY
```

### 2. Start Services (Docker)

```bash
# Start PostgreSQL, Redis, and Backend
docker-compose up

# In another terminal, initialize database
docker-compose exec backend npm run db:migrate
```

### 3. Access the System

- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/api/health
- **Chat Widget:** Build from `frontend/chat-widget`
- **Admin Dashboard:** Build from `frontend/admin-dashboard`

## 📁 Project Structure

```
ai-customer-support-agent/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── api/               # Route handlers
│   │   ├── services/          # Business logic
│   │   ├── config/            # Configuration
│   │   ├── middleware/        # Express middleware
│   │   └── utils/             # Utilities
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── chat-widget/           # Embeddable React widget
│   │   ├── src/
│   │   ├── dist/              # Built widget
│   │   └── package.json
│   │
│   └── admin-dashboard/       # Next.js admin panel
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
│
├── docs/                       # Documentation
│   ├── PRD.md
│   ├── COMPONENT_SPECS.md
│   └── TECH_STACK_SETUP.md
│
├── architecture/               # Architecture documentation
│   ├── ARCHITECTURE.md
│   └── DATABASE_SCHEMA.md
│
├── scripts/                    # Database & utility scripts
│   └── setup-db.sql
│
├── docker-compose.yml
├── .github/                    # GitHub Actions CI/CD
├── SETUP.md                    # Detailed setup guide
└── README.md                   # This file
```

## 🔌 API Endpoints

### Chat Endpoints

**Send Message**
```bash
POST /api/chat/message
Content-Type: application/json

{
  "conversation_id": "conv_123",
  "message": "How do I reset my password?",
  "session_id": "sess_xyz"
}
```

**Escalate to Human**
```bash
POST /api/chat/escalate
Content-Type: application/json

{
  "conversation_id": "conv_123",
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "message": "This is urgent"
}
```

### Admin Endpoints (Require JWT)

**Get Sources**
```bash
GET /api/admin/sources
Authorization: Bearer <token>
```

**Get Conversations**
```bash
GET /api/admin/conversations?limit=50&offset=0
Authorization: Bearer <token>
```

**Get Metrics**
```bash
GET /api/admin/metrics
Authorization: Bearer <token>
```

**Get Escalation Rules**
```bash
GET /api/admin/escalation-rules
Authorization: Bearer <token>
```

### Auth Endpoints

**Login**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password"
}
```

**Refresh Token**
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "<token>"
}
```

## 📊 Backend Architecture

### Core Components

1. **Chat/RAG Orchestrator** (`src/services/chatService.ts`)
   - Processes user queries
   - Retrieves relevant context from vector DB
   - Generates answers via LLM
   - Handles escalation logic

2. **LLM Integration** (`src/services/llmService.ts`)
   - OpenAI API integration
   - Embedding generation
   - Answer generation
   - Confidence scoring

3. **Vector Database** (`src/config/vectorDb.ts`)
   - Pinecone integration
   - Semantic search
   - Chunk storage and retrieval

4. **Database** (`src/config/database.ts`)
   - PostgreSQL connection pool
   - Tables for conversations, sources, escalations, etc.

5. **Authentication** (`src/middleware/auth.ts`)
   - JWT-based auth
   - Role-based access control

## 🎨 Frontend Architecture

### Chat Widget (`frontend/chat-widget/`)

- **Tech:** Vanilla TypeScript + Vite
- **Distribution:** UMD bundle (`dist/aicsa-widget.js`)
- **Usage:** Embed on any website via script tag

#### Widget Features:
- 💬 Real-time messaging
- 📱 Responsive design
- 🎨 Customizable theming
- 📝 Message history
- 🚀 Escalation to human agents
- ⚡ Zero dependencies (except axios)

#### Initialization:
```javascript
<script src="https://your-cdn.com/aicsa-widget.js"></script>
<script>
  const widget = new AICSAWidget({
    apiEndpoint: 'https://api.example.com',
    organizationId: 'org_123',
    theme: {
      primaryColor: '#007bff',
      welcomeMessage: 'Hi! How can we help?'
    }
  });
  widget.init();
</script>
```

### Admin Dashboard (`frontend/admin-dashboard/`)

- **Tech:** Next.js 14 + React 18 + Tailwind CSS
- **Pages:**
  - `/auth/login` - Authentication
  - `/dashboard` - Overview & metrics
  - `/dashboard/sources` - Knowledge source management
  - `/dashboard/conversations` - Chat logs & feedback
  - `/dashboard/escalation-rules` - Rule configuration
  - `/dashboard/settings` - System settings

#### Features:
- 📈 Real-time analytics
- 📚 Source upload & indexing
- 💬 Conversation review & feedback
- ⚙️ Escalation rule management
- 🔐 Role-based access control

## 🔧 Configuration

### Backend Environment Variables

```bash
# Server
NODE_ENV=development|production
BACKEND_PORT=3000
LOG_LEVEL=info|debug|error

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aicsa_db
DB_POOL_SIZE=20

# Vector DB (Pinecone)
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=us-west-2
PINECONE_INDEX_NAME=aicsa-prod

# LLM (OpenAI)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your_key
OPENAI_MODEL=gpt-4-turbo
EMBEDDING_MODEL=text-embedding-3-small

# RAG Configuration
RETRIEVAL_TOP_K=5
CONFIDENCE_THRESHOLD=0.6
MAX_CONTEXT_TOKENS=2000

# Authentication
JWT_SECRET=your_secret_key
JWT_EXPIRY=900

# Email / Escalation
SMTP_HOST=smtp.gmail.com
ESCALATION_EMAIL=support@company.com
```

### Frontend Environment Variables

```bash
# .env.local (Chat Widget & Admin Dashboard)
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3000
```

## 🗄️ Database Schema

Key tables:
- `organizations` - Tenant data
- `admin_users` - Team members
- `conversations` - Chat history
- `sources` - Knowledge bases
- `escalations` - Support tickets
- `escalation_rules` - Auto-escalation config
- `settings` - Organization settings

See `architecture/DATABASE_SCHEMA.md` for full schema.

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test              # Run unit tests
npm run test:integration  # Run integration tests
```

### Frontend Tests

```bash
cd frontend/chat-widget
npm test

cd frontend/admin-dashboard
npm test
```

## 🚢 Deployment

### Docker Build

```bash
# Build backend
docker build -t aicsa-backend:latest ./backend

# Build chat widget
cd frontend/chat-widget && npm run build
# Upload dist/aicsa-widget.js to CDN

# Build admin dashboard
cd frontend/admin-dashboard && npm run build
# Deploy to Vercel or hosting provider
```

### Environment Setup

1. **Backend:** Deploy to AWS ECS, Heroku, or your cloud provider
2. **Frontend Widget:** Host on CDN (CloudFront, CloudFlare, etc.)
3. **Admin Dashboard:** Deploy to Vercel, Netlify, or your host
4. **Database:** RDS PostgreSQL instance
5. **Cache:** ElastiCache Redis
6. **Vector DB:** Pinecone managed service

## 📚 Documentation

- **[PRD](docs/PRD.md)** - Product requirements & specifications
- **[Architecture](architecture/ARCHITECTURE.md)** - System design & components
- **[Component Specs](docs/COMPONENT_SPECS.md)** - API & UI specifications
- **[Database Schema](architecture/DATABASE_SCHEMA.md)** - SQL schema
- **[Setup Guide](SETUP.md)** - Detailed setup instructions
- **[Tech Stack](docs/TECH_STACK_SETUP.md)** - Technology choices & rationale

## 🔐 Security

- ✅ HTTPS/TLS for all traffic
- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Encrypted data at rest & in transit
- ✅ Input validation & sanitization
- ✅ CORS protection
- ✅ Rate limiting
- ✅ GDPR-compliant (no training on user data)

## 📈 Metrics & Success KPIs

- **First Contact Resolution (FCR):** ≥ 80%
- **Response Accuracy:** ≥ 95%
- **Response Time:** < 2 seconds
- **Escalation Rate:** < 20%
- **CSAT:** ≥ 4.5/5
- **Ticket Reduction:** ≥ 40% in 3-6 months

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

See GitHub issues for open tasks.

## 📝 License

MIT License - See LICENSE file for details

## 🆘 Support

- **Documentation:** See `docs/` folder
- **Issues:** GitHub Issues
- **Questions:** team@example.com

---

**Built with ❤️ - AI Customer Support Agent v1.0.0**
