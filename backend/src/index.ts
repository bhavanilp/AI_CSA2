import { initializeApp } from './app';
import { config } from './config/index';
import logger from './utils/logger';

const startServer = async (): Promise<void> => {
  try {
    const app = await initializeApp();

    app.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
