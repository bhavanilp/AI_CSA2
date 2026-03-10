# Database Schema

## Overview
PostgreSQL schema for the AI Customer Support Agent. Includes tables for organizations, users, conversations, knowledge sources, and configuration.

---

## Core Tables

### organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(255) UNIQUE,  -- e.g., "acme-corp"
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### admin_users
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer',  -- 'admin', 'viewer'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (organization_id, email)
);

CREATE INDEX idx_admin_users_org ON admin_users(organization_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);
```

### sources (knowledge sources)
```sql
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL,  -- 'website', 'pdf', 'faq', 'markdown'
  description TEXT,
  config JSONB,  -- {urls: [], crawl_depth: 2, exclude_patterns: []}
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'indexing', 'indexed', 'failed'
  chunk_count INT DEFAULT 0,
  embedding_model VARCHAR(255),  -- e.g., 'text-embedding-3-small'
  last_indexed TIMESTAMP,
  next_scheduled_index TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_sources_org_status ON sources(organization_id, status);
CREATE INDEX idx_sources_updated ON sources(updated_at);
```

### conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,  -- Browser session ID
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  
  -- Message history (stored as JSONB array)
  messages JSONB,  -- [{role: 'user'|'bot', content: string, timestamp: ISO8601, sources: [...]}, ...]
  message_count INT DEFAULT 0,
  
  -- Escalation info
  was_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason VARCHAR(255),  -- 'low_confidence', 'keyword_match', 'user_request', 'failed_attempts'
  escalation_id UUID,
  
  -- Feedback
  feedback_rating INT CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_is_correct BOOLEAN,
  feedback_comment TEXT,
  
  -- Metadata
  page_url VARCHAR(511),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_org_created ON conversations(organization_id, created_at DESC);
CREATE INDEX idx_conversations_session ON conversations(organization_id, session_id);
CREATE INDEX idx_conversations_email ON conversations(user_email);
CREATE INDEX idx_conversations_escalated ON conversations(organization_id, was_escalated);
```

### escalations (escalation tickets)
```sql
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  
  reason VARCHAR(255),  -- Why escalation happened
  ticket_reference VARCHAR(255),  -- Support system reference (e.g., 'SUP-2026-001234')
  status VARCHAR(50) DEFAULT 'open',  -- 'open', 'in_progress', 'resolved', 'closed'
  
  -- User info at escalation time
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  user_message TEXT,
  
  -- Agent assignment
  assigned_agent_id UUID,
  assigned_at TIMESTAMP,
  
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_agent_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_escalations_org_status ON escalations(organization_id, status);
CREATE INDEX idx_escalations_conversation ON escalations(conversation_id);
```

### escalation_rules (configuration)
```sql
CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  
  rule_type VARCHAR(50) NOT NULL,  -- 'failed_attempts', 'keyword', 'confidence'
  name VARCHAR(255),
  description TEXT,
  
  -- Configuration (differs by type)
  config JSONB,  -- 
    -- For 'failed_attempts': {attempts: 2}
    -- For 'keyword': {keywords: ["refund", "legal", "cancel"]}
    -- For 'confidence': {threshold: 0.6}
  
  escalation_email VARCHAR(255),
  escalation_webhook_url VARCHAR(511),  -- Optional: send webhook instead
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Apply to specific sources only (null = all sources)
  apply_to_source_ids UUID[],
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_escalation_rules_org ON escalation_rules(organization_id, enabled);
```

### settings (configuration)
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  
  -- Chat widget configuration
  widget_config JSONB,  -- {primaryColor: '#007bff', logo_url: '...', welcome_message: '...'}
  
  -- LLM configuration
  llm_model VARCHAR(255) DEFAULT 'gpt-4-turbo',
  llm_temperature NUMERIC DEFAULT 0.7,
  llm_max_tokens INT DEFAULT 1000,
  
  -- RAG configuration
  retrieval_top_k INT DEFAULT 5,
  confidence_threshold NUMERIC DEFAULT 0.6,
  max_context_tokens INT DEFAULT 2000,
  
  -- Chunking configuration
  chunk_size INT DEFAULT 1000,
  chunk_overlap INT DEFAULT 200,
  
  -- General
  enable_conversation_logging BOOLEAN DEFAULT TRUE,
  enable_feedback BOOLEAN DEFAULT TRUE,
  enable_sources_display BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

---

## Audit & Logging Tables

### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  
  action VARCHAR(255),  -- 'source_added', 'source_deleted', 'rule_updated', etc.
  resource_type VARCHAR(255),  -- 'source', 'escalation_rule', 'setting', etc.
  resource_id UUID,
  
  changes JSONB,  -- {before: {}, after: {}}
  
  ip_address VARCHAR(45),  -- IPv4 or IPv6
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
```

### error_logs
```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  
  error_type VARCHAR(255),  -- 'api_error', 'ingestion_error', 'llm_error', etc.
  error_message TEXT,
  error_stack TEXT,
  
  context JSONB,  -- {conversation_id: '...', source_id: '...', etc.}
  
  severity VARCHAR(50),  -- 'info', 'warning', 'error', 'critical'
  resolved BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_error_logs_org_created ON error_logs(organization_id, created_at DESC);
```

---

## Initialization Script

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema
CREATE SCHEMA IF NOT EXISTS public;

-- Run all table definitions above
-- ...

-- Create initial organization (for testing)
INSERT INTO organizations (name, subdomain) 
VALUES ('Default Org', 'default') 
ON CONFLICT DO NOTHING;

-- Create admin user for testing
INSERT INTO admin_users (organization_id, email, password_hash, role)
SELECT id, 'admin@example.com', crypt('password', gen_salt('bf')), 'admin'
FROM organizations 
WHERE subdomain = 'default'
ON CONFLICT DO NOTHING;

-- Set up sample escalation rules
INSERT INTO escalation_rules (organization_id, rule_type, name, config, escalation_email, enabled)
SELECT 
  id,
  'failed_attempts',
  'Escalate after 2 failed attempts',
  '{"attempts": 2}'::jsonb,
  'support@example.com',
  true
FROM organizations 
WHERE subdomain = 'default'
ON CONFLICT DO NOTHING;
```

---

## Views (Optional, for easier querying)

### conversation_summary
```sql
CREATE VIEW conversation_summary AS
SELECT 
  c.id,
  c.organization_id,
  c.session_id,
  c.user_email,
  c.user_name,
  c.message_count,
  c.was_escalated,
  c.feedback_rating,
  c.created_at,
  c.updated_at,
  COUNT(DISTINCT jsonb_array_elements(c.messages) ->> 'sources') as source_count
FROM conversations c
GROUP BY c.id;
```

### source_stats
```sql
CREATE VIEW source_stats AS
SELECT 
  s.id,
  s.organization_id,
  s.name,
  s.source_type,
  s.status,
  s.chunk_count,
  COUNT(DISTINCT c.id) as conversations_referencing,
  MAX(e.relevance_score) as max_relevance
FROM sources s
LEFT JOIN conversations c ON s.id = ANY(
  SELECT (jsonb_array_elements(m) -> 'sources' ->> 'source_id')::uuid 
  FROM jsonb_array_elements(c.messages) m
)
GROUP BY s.id;
```

---

## Performance Optimization

### Indexes Summary
```sql
-- Frequently queried
CREATE INDEX idx_conversations_org_created ON conversations(organization_id, created_at DESC);
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_escalations_org_status ON escalations(organization_id, status);

-- Full-text search (optional, for message search)
CREATE INDEX idx_conversations_messages_gin ON conversations USING GIN (messages);
```

### Partitioning (for large tables, in production)
```sql
-- Partition conversations by organization_id
CREATE TABLE conversations_partitioned (
  LIKE conversations
) PARTITION BY LIST (organization_id);

-- Create partitions per org
-- ALTER TABLE conversations_partitioned ATTACH PARTITION conversations_org_1 FOR VALUES IN ('org-1-id');
```

---

## Migration Strategy

1. **Create new tables** (using SQL above)
2. **Add indexes** for performance
3. **Create views** for convenience
4. **Seed initial data** (orgs, users, rules)
5. **Run tests** to verify schema

---
