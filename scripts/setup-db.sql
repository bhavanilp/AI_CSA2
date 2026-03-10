-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (organization_id, email)
);

-- Sources (knowledge sources)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  description TEXT,
  config JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  chunk_count INT DEFAULT 0,
  embedding_model VARCHAR(255),
  last_indexed TIMESTAMP,
  next_scheduled_index TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  messages JSONB,
  message_count INT DEFAULT 0,
  was_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason VARCHAR(255),
  escalation_id UUID,
  feedback_rating INT CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_is_correct BOOLEAN,
  feedback_comment TEXT,
  page_url VARCHAR(511),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Escalations
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  reason VARCHAR(255),
  ticket_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  user_message TEXT,
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

-- Escalation rules
CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  config JSONB,
  escalation_email VARCHAR(255),
  escalation_webhook_url VARCHAR(511),
  enabled BOOLEAN DEFAULT TRUE,
  apply_to_source_ids UUID[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Settings
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  widget_config JSONB,
  llm_model VARCHAR(255) DEFAULT 'gpt-4-turbo',
  llm_temperature NUMERIC DEFAULT 0.7,
  llm_max_tokens INT DEFAULT 1000,
  retrieval_top_k INT DEFAULT 5,
  confidence_threshold NUMERIC DEFAULT 0.6,
  max_context_tokens INT DEFAULT 2000,
  chunk_size INT DEFAULT 1000,
  chunk_overlap INT DEFAULT 200,
  enable_conversation_logging BOOLEAN DEFAULT TRUE,
  enable_feedback BOOLEAN DEFAULT TRUE,
  enable_sources_display BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(255),
  resource_type VARCHAR(255),
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Error logs
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  error_type VARCHAR(255),
  error_message TEXT,
  error_stack TEXT,
  context JSONB,
  severity VARCHAR(50),
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_admin_users_org ON admin_users(organization_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_sources_org_status ON sources(organization_id, status);
CREATE INDEX idx_sources_updated ON sources(updated_at);
CREATE INDEX idx_conversations_org_created ON conversations(organization_id, created_at DESC);
CREATE INDEX idx_conversations_session ON conversations(organization_id, session_id);
CREATE INDEX idx_conversations_email ON conversations(user_email);
CREATE INDEX idx_conversations_escalated ON conversations(organization_id, was_escalated);
CREATE INDEX idx_escalations_org_status ON escalations(organization_id, status);
CREATE INDEX idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX idx_escalation_rules_org ON escalation_rules(organization_id, enabled);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_error_logs_org_created ON error_logs(organization_id, created_at DESC);

-- Insert default organization
INSERT INTO organizations (name, subdomain) VALUES ('Default Org', 'default') ON CONFLICT DO NOTHING;

-- Insert sample escalation rules for default org
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

INSERT INTO escalation_rules (organization_id, rule_type, name, config, escalation_email, enabled)
SELECT 
  id,
  'keyword',
  'Escalate on sensitive keywords',
  '{"keywords": ["refund", "legal", "cancel", "urgent", "critical"]}'::jsonb,
  'support@example.com',
  true
FROM organizations 
WHERE subdomain = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO escalation_rules (organization_id, rule_type, name, config, escalation_email, enabled)
SELECT 
  id,
  'confidence',
  'Escalate on low confidence',
  '{"threshold": 0.6}'::jsonb,
  'support@example.com',
  true
FROM organizations 
WHERE subdomain = 'default'
ON CONFLICT DO NOTHING;
