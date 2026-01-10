import Redis from "ioredis";
import RedisManager from "../config/redis";


export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}


class CacheService {
  private redis: Redis | null = null;
  private defaultTTL = 3600; // 1 hour

  constructor() {
    // Initialize Redis client lazily
  }

  private getRedisClient(): Redis {
    if (!this.redis) {
      this.redis = RedisManager.getInstance().getClient();
    }
    return this.redis;
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const serializedValue = JSON.stringify(value);
      const ttl = options?.ttl || this.defaultTTL;

      await redis.setex(finalKey, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('Cache SET error:', error);
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const value = await redis.get(finalKey);
      
      if (value === null) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache GET error:', error);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const result = await redis.del(finalKey);
      return result > 0;
    } catch (error) {
      console.error('Cache DEL error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const result = await redis.exists(finalKey);
      return result === 1;
    } catch (error) {
      console.error('Cache EXISTS error:', error);
      return false;
    }
  }

  /**
   * Set multiple key-value pairs using pipeline
   */
  async mset(pairs: Record<string, any>, options?: CacheOptions): Promise<boolean> {
    try {
      const redis = this.getRedisClient();
      const ttl = options?.ttl || this.defaultTTL;
      const pipeline = redis.pipeline();

      Object.entries(pairs).forEach(([key, value]) => {
        const finalKey = this.buildKey(key, options?.prefix);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(finalKey, ttl, serializedValue);
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache MSET error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys using pipeline
   */
  async mget<T = any>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const redis = this.getRedisClient();
      const finalKeys = keys.map(key => this.buildKey(key, options?.prefix));
      const values = await redis.mget(...finalKeys);
      
      return values.map((value: string | null) => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Cache MGET error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Clear keys with a pattern using SCAN (non-blocking)
   * This is production-safe alternative to KEYS
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const redis = this.getRedisClient();
      let deletedCount = 0;
      const stream = redis.scanStream({
        match: pattern,
        count: 100, // Process 100 keys at a time
      });

      const pipeline = redis.pipeline();
      let pendingDeletes = 0;

      for await (const keys of stream) {
        if (keys.length > 0) {
          for (const key of keys) {
            pipeline.del(key);
            pendingDeletes++;
          }

          // Execute pipeline in batches of 100
          if (pendingDeletes >= 100) {
            const results = await pipeline.exec();
            deletedCount += results?.filter(([err, result]) => !err && result === 1).length || 0;
            pendingDeletes = 0;
          }
        }
      }

      // Execute remaining deletes
      if (pendingDeletes > 0) {
        const results = await pipeline.exec();
        deletedCount += results?.filter(([err, result]) => !err && result === 1).length || 0;
      }

      return deletedCount;
    } catch (error) {
      console.error('Cache CLEAR_PATTERN error:', error);
      return 0;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1, options?: CacheOptions): Promise<number> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const result = await redis.incrby(finalKey, amount);
      
      // Set expiry if provided
      if (options?.ttl) {
        await redis.expire(finalKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache INCREMENT error:', error);
      return 0;
    }
  }

  /**
   * Add item to a set
   */
  async sadd(key: string, members: string | string[], options?: CacheOptions): Promise<number> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const membersArray = Array.isArray(members) ? members : [members];
      const result = await redis.sadd(finalKey, ...membersArray);
      
      if (options?.ttl) {
        await redis.expire(finalKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache SADD error:', error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string, options?: CacheOptions): Promise<string[]> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      return await redis.smembers(finalKey);
    } catch (error) {
      console.error('Cache SMEMBERS error:', error);
      return [];
    }
  }

  /**
   * Remove items from a set
   */
  async srem(key: string, members: string | string[], options?: CacheOptions): Promise<number> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const membersArray = Array.isArray(members) ? members : [members];
      return await redis.srem(finalKey, ...membersArray);
    } catch (error) {
      console.error('Cache SREM error:', error);
      return 0;
    }
  }

  /**
   * Hash operations - set field
   */
  async hset(key: string, field: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const serializedValue = JSON.stringify(value);
      const result = await redis.hset(finalKey, field, serializedValue);
      
      if (options?.ttl) {
        await redis.expire(finalKey, options.ttl);
      }
      
      return result >= 0;
    } catch (error) {
      console.error('Cache HSET error:', error);
      return false;
    }
  }

  /**
   * Hash operations - get field
   */
  async hget<T = any>(key: string, field: string, options?: CacheOptions): Promise<T | null> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const value = await redis.hget(finalKey, field);
      
      if (value === null) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache HGET error:', error);
      return null;
    }
  }

  /**
   * Hash operations - get all fields
   */
  async hgetall<T = any>(key: string, options?: CacheOptions): Promise<Record<string, T>> {
    try {
      const redis = this.getRedisClient();
      const finalKey = this.buildKey(key, options?.prefix);
      const hash = await redis.hgetall(finalKey);
      
      const result: Record<string, T> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value) as T;
        } catch {
          result[field] = value as unknown as T;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Cache HGETALL error:', error);
      return {};
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const redis = this.getRedisClient();
      const info = await redis.info('memory');
      return this.parseRedisInfo(info);
    } catch (error) {
      console.error('Cache STATS error:', error);
      return null;
    }
  }

  /**
   * Check Redis connection health
   */
  async ping(): Promise<boolean> {
    try {
      const redis = this.getRedisClient();
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Build cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Parse Redis info string
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

export default CacheService;