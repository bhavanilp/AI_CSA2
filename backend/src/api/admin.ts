import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { deleteVectorsBySourceUrl } from '../config/vectorDb';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ingestWebsite } from '../services/ingestionService';
import logger from '../utils/logger';

const router = Router();

const computeResponseTimesFromMessages = (messages: any[]): number[] => {
  if (!Array.isArray(messages)) return [];

  const times: number[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i] || {};
    if (msg.role !== 'bot') continue;

    if (typeof msg.response_time_sec === 'number' && Number.isFinite(msg.response_time_sec)) {
      times.push(Math.max(0, Number(msg.response_time_sec)));
      continue;
    }

    if (typeof msg.response_time_ms === 'number' && Number.isFinite(msg.response_time_ms)) {
      times.push(Math.max(0, Number((msg.response_time_ms / 1000).toFixed(3))));
      continue;
    }

    // Fallback when explicit response time metadata is missing: derive from user->bot timestamp delta.
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = messages[j] || {};
      if (prev.role !== 'user') continue;

      const userTs = Date.parse(prev.timestamp || '');
      const botTs = Date.parse(msg.timestamp || '');
      if (!Number.isNaN(userTs) && !Number.isNaN(botTs) && botTs >= userTs) {
        times.push(Number(((botTs - userTs) / 1000).toFixed(3)));
      }
      break;
    }
  }

  return times;
};

const computeTokenUsageFromMessages = (messages: any[]): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  response_count: number;
} => {
  if (!Array.isArray(messages)) {
    return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, response_count: 0 };
  }

  return messages.reduce(
    (acc, msg) => {
      if (!msg || msg.role !== 'bot') {
        return acc;
      }

      const usage = msg.token_usage || {};
      const prompt = Number(usage.prompt_tokens) || 0;
      const completion = Number(usage.completion_tokens) || 0;
      const total = Number(usage.total_tokens) || prompt + completion;

      if (prompt <= 0 && completion <= 0 && total <= 0) {
        return acc;
      }

      acc.prompt_tokens += prompt;
      acc.completion_tokens += completion;
      acc.total_tokens += total;
      acc.response_count += 1;
      return acc;
    },
    {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      response_count: 0,
    },
  );
};

const extractSourceUrl = (sourceConfig: unknown): string | null => {
  if (!sourceConfig) {
    return null;
  }

  try {
    const parsed = typeof sourceConfig === 'string' ? JSON.parse(sourceConfig) : sourceConfig;
    if (parsed && typeof parsed === 'object' && typeof (parsed as any).url === 'string') {
      const url = (parsed as any).url.trim();
      return url.length > 0 ? url : null;
    }
  } catch {
    return null;
  }

  return null;
};

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/sources
router.get(
  '/sources',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query(
      `SELECT id, name, source_type, status, chunk_count, last_indexed, error_message, created_at
       FROM sources WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );

    const totalResult = await query(`SELECT COUNT(*) FROM sources WHERE organization_id = $1`, [organizationId]);

    res.status(200).json({
      sources: result.rows,
      total: parseInt(totalResult.rows[0].count),
      limit,
      offset,
    });
  })
);

// POST /api/admin/sources
router.post(
  '/sources',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, source_type, config } = req.body;
    const organizationId = req.organizationId;

    if (!name || !source_type) {
      res.status(400).json({ error: 'Name and source type are required' });
      return;
    }

    const sourceId = uuidv4();
    const result = await query(
      `INSERT INTO sources (id, organization_id, name, source_type, config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
       RETURNING id, name, source_type, status, created_at`,
      [sourceId, organizationId, name, source_type, JSON.stringify(config)]
    );

    // TODO: Trigger ingestion job
    logger.info(`Source created: ${sourceId}`);

    res.status(201).json(result.rows[0]);
  })
);

// DELETE /api/admin/sources/:id
router.delete(
  '/sources/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const result = await query(
      `DELETE FROM sources WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    res.status(204).end();
  })
);

// POST /api/admin/sources/remove-url
router.post(
  '/sources/remove-url',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId;
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    const deletedVectorCount = await deleteVectorsBySourceUrl(url, organizationId as string);

    const sourcesResult = await query(
      `SELECT id, config
       FROM sources WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, 1000, 0],
    );

    const matchingSourceIds = (sourcesResult.rows || [])
      .filter((row: any) => extractSourceUrl(row.config) === url)
      .map((row: any) => row.id)
      .filter(Boolean);

    let deletedSourceCount = 0;
    for (const sourceId of matchingSourceIds) {
      const deleteResult = await query(
        `DELETE FROM sources WHERE id = $1 AND organization_id = $2`,
        [sourceId, organizationId],
      );
      deletedSourceCount += deleteResult.rowCount || 0;
    }

    res.status(200).json({
      url,
      deleted_vector_count: deletedVectorCount,
      deleted_source_count: deletedSourceCount,
    });
  }),
);

// GET /api/admin/conversations
router.get(
  '/conversations',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const keyword = (req.query.keyword as string) || '';

    let whereClause = 'WHERE organization_id = $1';
    const params: any[] = [organizationId];

    if (keyword) {
      whereClause += ` AND (user_name ILIKE $${params.length + 1} OR user_email ILIKE $${params.length + 2})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const result = await query(
      `SELECT id, session_id, user_email, user_name, message_count, was_escalated, feedback_rating, created_at
       FROM conversations ${whereClause}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const totalResult = await query(`SELECT COUNT(*) FROM conversations ${whereClause}`, params);

    res.status(200).json({
      conversations: result.rows,
      total: parseInt(totalResult.rows[0].count),
      limit,
      offset,
    });
  })
);

// POST /api/admin/conversations/:id/feedback
router.post(
  '/conversations/:id/feedback',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rating, is_correct, comment } = req.body;
    const organizationId = req.organizationId;

    const result = await query(
      `UPDATE conversations 
       SET feedback_rating = $1, feedback_is_correct = $2, feedback_comment = $3, updated_at = NOW()
       WHERE id = $4 AND organization_id = $5
       RETURNING id`,
      [rating, is_correct, comment, id, organizationId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.status(200).json({ conversation_id: id, feedback_recorded: true });
  })
);

// GET /api/admin/metrics
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId;
    const startDate = (req.query.start_date as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = (req.query.end_date as string) || new Date().toISOString();

    const rowsResult = await query(
      `SELECT session_id, was_escalated, feedback_rating, messages
       FROM conversations
       WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3`,
      [organizationId, startDate, endDate],
    );

    const rows = rowsResult.rows || [];
    const totalConversations = rows.length;
    const escalatedCount = rows.filter((r: any) => !!r.was_escalated).length;

    const rated = rows
      .map((r: any) => (typeof r.feedback_rating === 'number' ? r.feedback_rating : null))
      .filter((v: number | null): v is number => v !== null);

    const avgSatisfaction = rated.length > 0 ? rated.reduce((sum, r) => sum + r, 0) / rated.length : 0;
    const uniqueUsers = new Set(rows.map((r: any) => r.session_id).filter(Boolean)).size;

    const allResponseTimes = rows.flatMap((r: any) => computeResponseTimesFromMessages(r.messages));
    const avgResponseTimeSec =
      allResponseTimes.length > 0
        ? Number((allResponseTimes.reduce((sum, t) => sum + t, 0) / allResponseTimes.length).toFixed(3))
        : 0;

    const tokenTotals = rows
      .map((r: any) => computeTokenUsageFromMessages(r.messages))
      .reduce(
        (acc, curr) => ({
          prompt_tokens: acc.prompt_tokens + curr.prompt_tokens,
          completion_tokens: acc.completion_tokens + curr.completion_tokens,
          total_tokens: acc.total_tokens + curr.total_tokens,
          response_count: acc.response_count + curr.response_count,
        }),
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, response_count: 0 },
      );

    const avgTokensPerResponse =
      tokenTotals.response_count > 0
        ? Number((tokenTotals.total_tokens / tokenTotals.response_count).toFixed(1))
        : 0;

    res.status(200).json({
      date_range: { start: startDate, end: endDate },
      stats: {
        total_conversations: totalConversations,
        avg_response_time_sec: avgResponseTimeSec,
        escalation_rate: totalConversations > 0 ? escalatedCount / totalConversations : 0,
        avg_satisfaction: avgSatisfaction,
        unique_users: uniqueUsers,
        token_usage: {
          total_prompt_tokens: tokenTotals.prompt_tokens,
          total_completion_tokens: tokenTotals.completion_tokens,
          total_tokens: tokenTotals.total_tokens,
          avg_tokens_per_response: avgTokensPerResponse,
        },
      },
    });
  })
);

// GET /api/admin/escalation-rules
router.get(
  '/escalation-rules',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId;

    const result = await query(
      `SELECT id, rule_type, name, config, escalation_email, enabled
       FROM escalation_rules WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    res.status(200).json({ rules: result.rows });
  })
);

// PUT /api/admin/escalation-rules/:id
router.put(
  '/escalation-rules/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { enabled, escalation_email } = req.body;
    const organizationId = req.organizationId;

    const result = await query(
      `UPDATE escalation_rules 
       SET enabled = COALESCE($1, enabled), escalation_email = COALESCE($2, escalation_email), updated_at = NOW()
       WHERE id = $3 AND organization_id = $4
       RETURNING id, updated_at`,
      [enabled !== undefined ? enabled : null, escalation_email, id, organizationId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.status(200).json({ rule_id: id, updated_at: result.rows[0].updated_at });
  })
);

// POST /api/admin/sources/ingest-url
router.post(
  '/sources/ingest-url',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId;
    const { url, source_name } = req.body;

    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    const result = await ingestWebsite(organizationId as string, url, source_name);

    // Persist a source record so GET /api/admin/sources reflects ingested content
    await query(
      `INSERT INTO sources (id, organization_id, name, source_type, config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'indexed', NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        result.sourceId,
        organizationId,
        source_name || new URL(url).hostname,
        'website',
        JSON.stringify({ url, chunk_count: result.chunkCount }),
      ],
    );

    res.status(201).json({
      source_id: result.sourceId,
      source_url: result.url,
      chunk_count: result.chunkCount,
      status: 'indexed',
    });
  }),
);

export default router;
