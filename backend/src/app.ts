import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import { initializePinecone } from './config/vectorDb';
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
