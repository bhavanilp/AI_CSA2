import { Router, Request, Response } from 'express';
import { getIngestedSourceUrls } from '../config/vectorDb';

const router = Router();

// GET /api/health
router.get('/', (_req: Request, res: Response) => {
  const ingestedUrls = getIngestedSourceUrls();
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: 'ok',
      vector_db: 'ok',
      llm_provider: 'ok',
    },
    vector_store: {
      loaded_vector_count: ingestedUrls.length > 0 ? 'see ingested_urls' : 0,
      ingested_url_count: ingestedUrls.length,
      ingested_urls: ingestedUrls,
    },
  });
});

export default router;
