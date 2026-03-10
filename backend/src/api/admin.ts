import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ingestWebsite } from '../services/ingestionService';
import logger from '../utils/logger';

const router = Router();

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

    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_conversations,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_response_time_sec,
        SUM(CASE WHEN was_escalated THEN 1 ELSE 0 END)::float / COUNT(*) as escalation_rate,
        AVG(feedback_rating) as avg_satisfaction,
        COUNT(DISTINCT session_id) as unique_users
       FROM conversations
       WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3`,
      [organizationId, startDate, endDate]
    );

    const stats = statsResult.rows[0];

    res.status(200).json({
      date_range: { start: startDate, end: endDate },
      stats: {
        total_conversations: parseInt(stats.total_conversations),
        avg_response_time_ms: stats.avg_response_time_sec ? Math.round(stats.avg_response_time_sec * 1000) : 0,
        escalation_rate: stats.escalation_rate || 0,
        avg_satisfaction: stats.avg_satisfaction || 0,
        unique_users: parseInt(stats.unique_users),
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
