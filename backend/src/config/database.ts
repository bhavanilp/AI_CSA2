import bcryptjs from 'bcryptjs';
import { promises as fs } from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { config } from '../config/index';
import logger from '../utils/logger';

type QueryResult = { rows: any[]; rowCount: number };

let pool: Pool | null = null;
let useInMemoryDb = false;

const memoryDb = {
  adminUsers: [] as any[],
  conversations: [] as any[],
  sources: [] as any[],
  escalationRules: [] as any[],
};

const MEMORY_DB_PATH = path.resolve(process.cwd(), 'data', 'local-memory-db.json');

type MemoryDbSnapshot = {
  adminUsers: any[];
  conversations: any[];
  sources: any[];
  escalationRules: any[];
  updated_at: string;
};

const saveMemoryDbToFile = async (): Promise<void> => {
  const snapshot: MemoryDbSnapshot = {
    adminUsers: memoryDb.adminUsers,
    conversations: memoryDb.conversations,
    sources: memoryDb.sources,
    escalationRules: memoryDb.escalationRules,
    updated_at: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(MEMORY_DB_PATH), { recursive: true });
  await fs.writeFile(MEMORY_DB_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
};

const loadMemoryDbFromFile = async (): Promise<void> => {
  try {
    const raw = await fs.readFile(MEMORY_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MemoryDbSnapshot>;

    memoryDb.adminUsers = Array.isArray(parsed.adminUsers) ? parsed.adminUsers : [];
    memoryDb.conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
    memoryDb.sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    memoryDb.escalationRules = Array.isArray(parsed.escalationRules) ? parsed.escalationRules : [];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
};

const ensureSeedData = async (): Promise<void> => {
  if (memoryDb.adminUsers.length === 0) {
    const passwordHash = await bcryptjs.hash('Admin@123', 10);
    memoryDb.adminUsers.push({
      id: 'admin-local-1',
      organization_id: 'default',
      email: 'admin@aicsa.local',
      password_hash: passwordHash,
      role: 'admin',
      last_login: null,
    });
  }

  if (memoryDb.escalationRules.length === 0) {
    memoryDb.escalationRules.push({
      id: 'rule-local-1',
      organization_id: 'default',
      rule_type: 'keyword',
      name: 'Default keyword escalation',
      config: { keywords: ['refund', 'cancel', 'complaint', 'human', 'agent'] },
      escalation_email: 'support@company.com',
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
};

const persistInMemoryMutation = async (): Promise<void> => {
  if (!useInMemoryDb) {
    return;
  }

  try {
    await saveMemoryDbToFile();
  } catch (error) {
    logger.warn(`Failed to persist in-memory DB snapshot: ${error}`);
  }
};

const queryInMemory = async (text: string, params: any[] = []): Promise<QueryResult> => {
  const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

  if (sql.includes('select now()')) {
    return { rows: [{ now: new Date().toISOString() }], rowCount: 1 };
  }

  if (sql.includes('select * from admin_users where email = $1')) {
    const email = params[0];
    const user = memoryDb.adminUsers.find((item) => item.email === email);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  if (sql.includes('update admin_users set last_login = now() where id = $1')) {
    const id = params[0];
    const user = memoryDb.adminUsers.find((item) => item.id === id);
    if (!user) {
      return { rows: [], rowCount: 0 };
    }
    user.last_login = new Date().toISOString();
    await persistInMemoryMutation();
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('select config from escalation_rules')) {
    const organizationId = params[0];
    const rules = memoryDb.escalationRules.filter(
      (item) => item.organization_id === organizationId && item.rule_type === 'keyword' && item.enabled
    );
    return { rows: rules.map((item) => ({ config: item.config })), rowCount: rules.length };
  }

  if (sql.startsWith('insert into conversations')) {
    const [id, organizationId, sessionId, messages, messageCount, wasEscalated, escalationReason] = params;
    const existing = memoryDb.conversations.find((item) => item.id === id);

    if (existing) {
      const nextMessages = Array.isArray(messages) ? messages : [];
      if (!Array.isArray(existing.messages)) {
        existing.messages = [];
      }
      if (nextMessages.length > 0) {
        existing.messages.push(...nextMessages);
      }
      existing.message_count = (existing.message_count || 0) + nextMessages.length;
      existing.was_escalated = wasEscalated;
      existing.escalation_reason = escalationReason || existing.escalation_reason;
      existing.updated_at = new Date().toISOString();
    } else {
      memoryDb.conversations.push({
        id,
        organization_id: organizationId,
        session_id: sessionId,
        user_email: null,
        user_name: null,
        messages: Array.isArray(messages) ? messages : [],
        message_count: messageCount,
        was_escalated: wasEscalated,
        escalation_reason: escalationReason,
        feedback_rating: null,
        feedback_is_correct: null,
        feedback_comment: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    await persistInMemoryMutation();
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('from conversations where id = $1')) {
    const id = params[0];
    const conversation = memoryDb.conversations.find((item) => item.id === id);
    return { rows: conversation ? [conversation] : [], rowCount: conversation ? 1 : 0 };
  }

  if (sql.includes('from sources where organization_id = $1') && sql.includes('order by created_at desc')) {
    const [organizationId, limit = 50, offset = 0] = params;
    const rows = memoryDb.sources
      .filter((item) => item.organization_id === organizationId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(offset, offset + limit);
    return { rows, rowCount: rows.length };
  }

  if (sql.includes('select count(*) from sources where organization_id = $1')) {
    const organizationId = params[0];
    const count = memoryDb.sources.filter((item) => item.organization_id === organizationId).length;
    return { rows: [{ count: String(count) }], rowCount: 1 };
  }

  if (sql.startsWith('insert into sources')) {
    const [id, organizationId, name, sourceType, sourceConfig] = params;

    // ON CONFLICT DO NOTHING — skip if ID already present
    if (sql.includes('on conflict do nothing')) {
      const existing = memoryDb.sources.find((item) => item.id === id);
      if (existing) {
        return { rows: [], rowCount: 0 };
      }
    }

    // Determine status from SQL (indexed vs pending)
    const initialStatus = sql.includes("'indexed'") ? 'indexed' : 'pending';
    const row = {
      id,
      organization_id: organizationId,
      name,
      source_type: sourceType,
      config: sourceConfig,
      status: initialStatus,
      chunk_count: 0,
      last_indexed: initialStatus === 'indexed' ? new Date().toISOString() : null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryDb.sources.push(row);
    await persistInMemoryMutation();
    return {
      rows: [
        {
          id: row.id,
          name: row.name,
          source_type: row.source_type,
          status: row.status,
          created_at: row.created_at,
        },
      ],
      rowCount: 1,
    };
  }

  if (sql.startsWith('delete from sources where id = $1 and organization_id = $2')) {
    const [id, organizationId] = params;
    const before = memoryDb.sources.length;
    memoryDb.sources = memoryDb.sources.filter((item) => !(item.id === id && item.organization_id === organizationId));
    await persistInMemoryMutation();
    return { rows: [], rowCount: before - memoryDb.sources.length };
  }

  if (sql.includes('from conversations where organization_id = $1') && sql.includes('order by created_at desc')) {
    const [organizationId, limit, offset] = params;
    const rows = memoryDb.conversations
      .filter((item) => item.organization_id === organizationId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(offset || 0, (offset || 0) + (limit || 50));
    return { rows, rowCount: rows.length };
  }

  if (sql.includes('select count(*) from conversations where organization_id = $1')) {
    const organizationId = params[0];
    const count = memoryDb.conversations.filter((item) => item.organization_id === organizationId).length;
    return { rows: [{ count: String(count) }], rowCount: 1 };
  }

  if (sql.startsWith('update conversations set feedback_rating = $1')) {
    const [rating, isCorrect, comment, id, organizationId] = params;
    const row = memoryDb.conversations.find((item) => item.id === id && item.organization_id === organizationId);
    if (!row) {
      return { rows: [], rowCount: 0 };
    }
    row.feedback_rating = rating;
    row.feedback_is_correct = isCorrect;
    row.feedback_comment = comment;
    row.updated_at = new Date().toISOString();
    await persistInMemoryMutation();
    return { rows: [{ id: row.id }], rowCount: 1 };
  }

  if (sql.includes('count(*) as total_conversations') && sql.includes('from conversations')) {
    const organizationId = params[0];
    const rows = memoryDb.conversations.filter((item) => item.organization_id === organizationId);
    const total = rows.length;
    const escalated = rows.filter((item) => item.was_escalated).length;
    const rated = rows.filter((item) => typeof item.feedback_rating === 'number');
    const uniqueUsers = new Set(rows.map((item) => item.session_id)).size;

    const avgSatisfaction =
      rated.length > 0 ? rated.reduce((sum, item) => sum + Number(item.feedback_rating || 0), 0) / rated.length : 0;

    return {
      rows: [
        {
          total_conversations: String(total),
          avg_response_time_sec: 0,
          escalation_rate: total > 0 ? escalated / total : 0,
          avg_satisfaction: avgSatisfaction,
          unique_users: String(uniqueUsers),
        },
      ],
      rowCount: 1,
    };
  }

  if (sql.includes('from escalation_rules where organization_id = $1') && sql.includes('order by created_at desc')) {
    const organizationId = params[0];
    const rows = memoryDb.escalationRules.filter((item) => item.organization_id === organizationId);
    return { rows, rowCount: rows.length };
  }

  if (sql.startsWith('update escalation_rules set enabled = coalesce($1, enabled)')) {
    const [enabled, escalationEmail, id, organizationId] = params;
    const row = memoryDb.escalationRules.find((item) => item.id === id && item.organization_id === organizationId);
    if (!row) {
      return { rows: [], rowCount: 0 };
    }

    if (enabled !== null && enabled !== undefined) {
      row.enabled = enabled;
    }
    if (escalationEmail) {
      row.escalation_email = escalationEmail;
    }
    row.updated_at = new Date().toISOString();
    await persistInMemoryMutation();
    return { rows: [{ id: row.id, updated_at: row.updated_at }], rowCount: 1 };
  }

  logger.warn(`Unhandled in-memory SQL: ${text}`);
  return { rows: [], rowCount: 0 };
};

export const initializeDatabase = async (): Promise<void> => {
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.pool_size,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.database.timeout,
    });

    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    useInMemoryDb = false;
    logger.info('Database connected successfully');
  } catch (error) {
    useInMemoryDb = true;
    await loadMemoryDbFromFile();
    await ensureSeedData();
    await saveMemoryDbToFile();
    logger.warn(`Database unavailable. Falling back to in-memory DB: ${error}`);
    logger.info(`In-memory DB snapshots are persisted at ${MEMORY_DB_PATH}`);
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
};

export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();

  if (useInMemoryDb || !pool) {
    const result = await queryInMemory(text, params || []);
    const duration = Date.now() - start;
    logger.debug(`Executed in-memory query in ${duration}ms`);
    return result;
  }

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Executed query in ${duration}ms`);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    logger.error(`Database error: ${error}`);
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool.connect();
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};
