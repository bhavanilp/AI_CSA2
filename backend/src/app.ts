import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index';
import { initializeDatabase, query } from './config/database';
import crypto from 'crypto';
import { initializeRedis } from './config/redis';
import { initializePinecone, getIngestedSourceUrls } from './config/vectorDb';
import { initializeOpenAI } from './services/llmService';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

// Import routes
import chatRoutes from './api/chat';
import authRoutes from './api/auth';
import adminRoutes from './api/admin';
import healthRoutes from './api/health';

let app: Express;

export const initializeApp = async (): Promise<Express> => {
  app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize services
  try {
    await initializeDatabase();
    await initializeRedis();
    await initializePinecone();
    initializeOpenAI();
    logger.info('All services initialized successfully');
    // Sync persisted vector store URLs into in-memory sources table
    try {
      const urls = getIngestedSourceUrls();
      if (urls.length > 0) {
        for (const url of urls) {
          const name = url.replace(/^https?:\/\//, '').replace(/\//g, '_');
          const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
          const id = `vs-${hash}`;
          await query(
            `INSERT INTO sources (id, organization_id, name, source_type, config, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'indexed', NOW(), NOW()) ON CONFLICT DO NOTHING`,
            [id, 'default', name, 'website', JSON.stringify({ url })]
          );
        }
        logger.info(`Synced ${urls.length} vector store URL(s) to sources table`);
      }
    } catch (syncErr) {
      logger.warn(`Could not sync vector store URLs to sources: ${syncErr}`);
    }
  } catch (error) {
    logger.error(`Service initialization failed: ${error}`);
    throw error;
  }

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

export const getApp = (): Express => {
  if (!app) {
    throw new Error('App not initialized');
  }
  return app;
};
