# AI Customer Support Agent - Quick Start Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 13+
- Redis 7+
- Docker & Docker Compose (optional)
- OpenAI API key
- Pinecone API key (for vector database)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourorg/ai-customer-support-agent.git
cd ai-customer-support-agent
```

### 2. Backend Setup

#### Option A: Local Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Create logs directory
mkdir logs uploads

# Start PostgreSQL (Docker)
docker run -d \
  --name aicsa_postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=aicsa_db \
  -p 5432:5432 \
  postgres:15-alpine

# Start Redis (Docker)
docker run -d \
  --name aicsa_redis \
  -p 6379:6379 \
  redis:7-alpine

# Initialize database
npm run db:migrate

# Update .env with your API keys
# - OPENAI_API_KEY
# - PINECONE_API_KEY

# Start backend
npm run dev
```

#### Option B: Docker Compose

```bash
# From project root
docker-compose up

# In another terminal, initialize database
docker-compose exec backend npm run db:migrate
```

### 3. Frontend Chat Widget Setup

```bash
cd frontend/chat-widget

# Install dependencies
npm install

# Build widget
npm run build

# Output: dist/aicsa-widget.js (ready to embed)

# For development with hot reload
npm run dev
```

### 4. Embed Widget on Website

Add this script to your HTML:

```html
<script src="https://your-cdn.com/aicsa-widget.js"></script>
<script>
  const widget = new window.AICSAWidget({
    apiEndpoint: 'http://localhost:3000',
    organizationId: 'your-org-id',
    theme: {
      primaryColor: '#007bff',
      logoUrl: 'https://example.com/logo.png',
      welcomeMessage: 'Hi! How can we help?'
    },
    position: 'bottom-right'
  });
  widget.init();
</script>
```

## Configuration

### Backend Environment Variables

Key variables in `.env`:

```bash
# API
BACKEND_PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aicsa_db

# Vector DB
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=us-west-2
PINECONE_INDEX_NAME=aicsa-prod

# LLM
OPENAI_API_KEY=sk-your_key
OPENAI_MODEL=gpt-4-turbo

# RAG
RETRIEVAL_TOP_K=5
CONFIDENCE_THRESHOLD=0.6
```

### Chat Widget Configuration

```typescript
{
  apiEndpoint: string;           // Backend API URL
  organizationId: string;        // Your organization ID
  theme?: {
    primaryColor?: string;       // Default: '#007bff'
    logoUrl?: string;
    welcomeMessage?: string;     // Default: 'Hi! How can we help?'
    placeholder?: string;        // Input placeholder
  };
  position?: 'bottom-right' | 'bottom-left' | 'top-right';
  maxHeight?: number;            // Max chat height in px
  zIndex?: number;               // CSS z-index
  onEscalate?: (data) => void;   // Escalation callback
}
```

## API Endpoints

### Chat Endpoints

**POST /api/chat/message**
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123",
    "message": "How do I reset my password?",
    "session_id": "sess_xyz"
  }'
```

**POST /api/chat/escalate**
```bash
curl -X POST http://localhost:3000/api/chat/escalate \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "message": "This is urgent"
  }'
```

### Admin Endpoints

All admin endpoints require JWT authentication:

```bash
# Get sources
curl -X GET http://localhost:3000/api/admin/sources \
  -H "Authorization: Bearer <token>"

# Create source
curl -X POST http://localhost:3000/api/admin/sources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "FAQ",
    "source_type": "website",
    "config": {"urls": ["https://example.com/faq"]}
  }'

# Get conversations
curl -X GET http://localhost:3000/api/admin/conversations \
  -H "Authorization: Bearer <token>"

# Get metrics
curl -X GET http://localhost:3000/api/admin/metrics \
  -H "Authorization: Bearer <token>"
```

### Auth Endpoints

**POST /api/auth/login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password"
  }'
```

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend/chat-widget
npm test
```

### Linting & Formatting

```bash
# Backend
cd backend
npm run lint
npm run format

# Frontend
cd frontend/chat-widget
npm run lint
```

### Database Migrations

```bash
cd backend

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

## Troubleshooting

### Database Connection Error

1. Check PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

2. Verify DATABASE_URL in .env

3. Recreate database:
   ```bash
   dropdb aicsa_db
   createdb aicsa_db
   npm run db:migrate
   ```

### Vector Database Error

1. Verify Pinecone API key
2. Check index exists: `PINECONE_INDEX_NAME`
3. Verify network connectivity to Pinecone

### OpenAI API Error

1. Check OPENAI_API_KEY is valid
2. Verify API key has access to model
3. Check rate limits and quota

### Widget Not Appearing

1. Check console for errors
2. Verify apiEndpoint and organizationId
3. Check backend CORS configuration
4. Verify widget script is loaded

## Production Deployment

### Backend Deployment (AWS)

1. Build Docker image:
   ```bash
   docker build -t aicsa-backend:1.0.0 ./backend
   ```

2. Push to ECR:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
   docker tag aicsa-backend:1.0.0 <account>.dkr.ecr.us-east-1.amazonaws.com/aicsa-backend:1.0.0
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/aicsa-backend:1.0.0
   ```

3. Update ECS task definition and service

### Frontend Deployment (CDN)

1. Build widget:
   ```bash
   cd frontend/chat-widget && npm run build
   ```

2. Upload to S3:
   ```bash
   aws s3 cp dist/aicsa-widget.js s3://your-bucket/aicsa-widget/v1.0.0/
   ```

3. Invalidate CloudFront cache (if using)

## Additional Resources

- **Architecture:** See `docs/ARCHITECTURE.md`
- **API Documentation:** See `docs/COMPONENT_SPECS.md`
- **Product Spec:** See `docs/PRD.md`
- **Database Schema:** See `architecture/DATABASE_SCHEMA.md`

## Support

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Contact:** team@example.com

---

**Happy coding! 🚀**
