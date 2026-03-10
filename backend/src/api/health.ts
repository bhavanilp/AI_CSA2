import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/health
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: 'ok',
      vector_db: 'ok',
      llm_provider: 'ok',
    },
  });
});

export default router;
