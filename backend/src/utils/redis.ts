import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType;

export async function setupRedis(): Promise<RedisClientType> {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 1000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    logger.info('Redis connection established successfully');
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis client disconnected');
    }
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
  }
}

// Cache helper functions
export class CacheService {
  private ttl: number;

  constructor(defaultTtl: number = 3600) {
    this.ttl = defaultTtl;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiration = ttl || this.ttl;
      await redisClient.setEx(key, expiration, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      return await redisClient.incrBy(key, value);
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  async setHash(key: string, field: string, value: any): Promise<boolean> {
    try {
      await redisClient.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache hash set error for key ${key}:`, error);
      return false;
    }
  }

  async getHash<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await redisClient.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache hash get error for key ${key}:`, error);
      return null;
    }
  }

  async getAllHash<T>(key: string): Promise<Record<string, T>> {
    try {
      const hash = await redisClient.hGetAll(key);
      const result: Record<string, T> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      logger.error(`Cache get all hash error for key ${key}:`, error);
      return {};
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      await redisClient.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      await redisClient.flushAll();
      logger.info('Redis cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }
}

// Health check function
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

// Create cache service instance
export const cache = new CacheService();

export { redisClient };
export default redisClient;