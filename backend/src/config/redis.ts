import { createClient, RedisClientType } from 'redis';
import { config } from './index';
import logger from '../utils/logger';

let redisClient: RedisClientType;
let useInMemoryRedis = false;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

const setMemory = (key: string, value: string, ttl: number): void => {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
};

const getMemory = (key: string): string | null => {
  const item = memoryCache.get(key);
  if (!item) {
    return null;
  }

  if (item.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return item.value;
};

export const initializeRedis = async (): Promise<void> => {
  if (process.env.REDIS_DISABLED === 'true') {
    useInMemoryRedis = true;
    logger.warn('Redis disabled via REDIS_DISABLED=true. Using in-memory cache.');
    return;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
      password: config.redis.password || undefined,
      socket: {
        reconnectStrategy: () => false,
      },
    });

    redisClient.on('error', (error) => {
      if (!useInMemoryRedis) {
        logger.error(`Redis error: ${error}`);
      }
    });
    redisClient.on('connect', () => logger.info('Redis connected'));

    await redisClient.connect();
  } catch (error) {
    useInMemoryRedis = true;
    if (redisClient && redisClient.isOpen) {
      await redisClient.disconnect();
    }
    logger.warn(`Redis unavailable. Falling back to in-memory cache: ${error}`);
  }
};

export const getRedis = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis not initialized');
  }
  return redisClient;
};

export const setCache = async (key: string, value: any, ttl: number = 3600): Promise<void> => {
  try {
    if (useInMemoryRedis) {
      setMemory(key, JSON.stringify(value), ttl);
      return;
    }
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.error(`Cache set error: ${error}`);
  }
};

export const getCache = async (key: string): Promise<any> => {
  try {
    if (useInMemoryRedis) {
      const value = getMemory(key);
      return value ? JSON.parse(value) : null;
    }
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error(`Cache get error: ${error}`);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    if (useInMemoryRedis) {
      memoryCache.delete(key);
      return;
    }
    await redisClient.del(key);
  } catch (error) {
    logger.error(`Cache delete error: ${error}`);
  }
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient && !useInMemoryRedis) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};
