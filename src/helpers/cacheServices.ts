import NodeCache from "node-cache";

export type CacheOptions = {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

// Single in-process store shared by every CacheService instance in the app,
// matching the old behaviour where all instances talked to the same Redis server.
// checkperiod sweeps expired keys so they don't linger in memory after their TTL.
const store = new NodeCache({ checkperiod: 120 });

class CacheService {
  private defaultTTL = 3600; // 1 hour

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const finalKey = this.buildKey(key, options?.prefix);
      const serializedValue = JSON.stringify(value);
      const ttl = options?.ttl ?? this.defaultTTL;

      store.set(finalKey, serializedValue, ttl);
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
      const finalKey = this.buildKey(key, options?.prefix);
      const value = store.get<string>(finalKey);

      if (value === undefined) return null;

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
      const finalKey = this.buildKey(key, options?.prefix);
      const result = store.del(finalKey);
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
      const finalKey = this.buildKey(key, options?.prefix);
      return store.has(finalKey);
    } catch (error) {
      console.error('Cache EXISTS error:', error);
      return false;
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(pairs: Record<string, any>, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl ?? this.defaultTTL;

      Object.entries(pairs).forEach(([key, value]) => {
        const finalKey = this.buildKey(key, options?.prefix);
        store.set(finalKey, JSON.stringify(value), ttl);
      });

      return true;
    } catch (error) {
      console.error('Cache MSET error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = any>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      return keys.map(key => {
        const finalKey = this.buildKey(key, options?.prefix);
        const value = store.get<string>(finalKey);
        if (value === undefined) return null;
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
   * Clear keys matching a glob-style pattern (supports '*' wildcard)
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const regex = new RegExp(
        `^${pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`,
      );
      const matchingKeys = store.keys().filter(key => regex.test(key));
      if (matchingKeys.length === 0) return 0;
      return store.del(matchingKeys);
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
      const finalKey = this.buildKey(key, options?.prefix);
      const current = store.get<number>(finalKey) ?? 0;
      const result = current + amount;

      if (options?.ttl) {
        store.set(finalKey, result, options.ttl);
      } else {
        store.set(finalKey, result);
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
      const finalKey = this.buildKey(key, options?.prefix);
      const membersArray = Array.isArray(members) ? members : [members];
      const existing = store.get<string[]>(finalKey) ?? [];
      const added = membersArray.filter(m => !existing.includes(m));
      const updated = [...existing, ...added];

      if (options?.ttl) {
        store.set(finalKey, updated, options.ttl);
      } else {
        store.set(finalKey, updated);
      }

      return added.length;
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
      const finalKey = this.buildKey(key, options?.prefix);
      return store.get<string[]>(finalKey) ?? [];
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
      const finalKey = this.buildKey(key, options?.prefix);
      const membersArray = Array.isArray(members) ? members : [members];
      const existing = store.get<string[]>(finalKey) ?? [];
      const updated = existing.filter(m => !membersArray.includes(m));

      store.set(finalKey, updated);

      return existing.length - updated.length;
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
      const finalKey = this.buildKey(key, options?.prefix);
      const hash = store.get<Record<string, string>>(finalKey) ?? {};
      hash[field] = JSON.stringify(value);

      if (options?.ttl) {
        store.set(finalKey, hash, options.ttl);
      } else {
        store.set(finalKey, hash);
      }

      return true;
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
      const finalKey = this.buildKey(key, options?.prefix);
      const hash = store.get<Record<string, string>>(finalKey);
      const value = hash?.[field];

      if (value === undefined) return null;

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
      const finalKey = this.buildKey(key, options?.prefix);
      const hash = store.get<Record<string, string>>(finalKey) ?? {};

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
      return store.getStats();
    } catch (error) {
      console.error('Cache STATS error:', error);
      return null;
    }
  }

  /**
   * Check cache health (always available - it's in-process)
   */
  async ping(): Promise<boolean> {
    return true;
  }

  /**
   * Build cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }
}

export default CacheService;
