import { initializeApp } from './app';
import { config } from './config/index';
import logger from './utils/logger';
import http from 'http';

let httpServer: http.Server | null = null;

const startServer = async (): Promise<void> => {
  try {
    const app = await initializeApp();

    httpServer = app.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();

const shutdown = (signal: string) => {
  logger.info(`${signal} received: closing HTTP server`);
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    // Force exit after 3 s if close stalls
    setTimeout(() => process.exit(0), 3000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
