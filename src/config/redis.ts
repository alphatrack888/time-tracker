import Redis from 'ioredis'
import config from '.'


export interface RedisConfig {
    host: string
    port: number
    password?: string
    db?: number
    maxRetriesPerRequest?: number
    retryDelayOnFailover?: number
    lazyConnect?: boolean

}



class RedisManager{
    private static instance: RedisManager;

    private redis:Redis | null = null
    private isConnected: boolean = false

    private constructor(){}


    public static getInstance(): RedisManager{
        if(!RedisManager.instance){
            RedisManager.instance = new RedisManager()
        }
        return RedisManager.instance
    }


    public async connect(paramConfig?: RedisConfig): Promise<Redis> {
    if (this.isConnected && this.redis) {
      return this.redis;
    }

    const redisConfig: RedisConfig = {
      host: config.redis.host || 'localhost',
      port: Number(config.redis.port || '6379'),
      password: config.redis.password,
      db: Number(config.redis.db || '0'),
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      ...paramConfig,
    };

    this.redis = new Redis(redisConfig);

    // Event handlers
    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (err: Error) => {
      console.error('❌ Redis connection error:', err);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    // Actually connect (since lazyConnect is true)
    await this.redis.connect();
    
    return this.redis;
  }

  public getClient(): Redis {
    if (!this.redis) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.redis;
  }

 public createNewConnection(config?: Partial<RedisConfig>, forBullMQ: boolean = false): Redis {
    if (!this.redis) {
      throw new Error('Redis manager not initialized. Call connect() first.');
    }

    const baseConfig = this.redis.options;
    
    return new Redis({
      host: baseConfig.host,
      port: baseConfig.port,
      password: baseConfig.password,
      db: baseConfig.db,
      maxRetriesPerRequest: forBullMQ ? null : baseConfig.maxRetriesPerRequest,
      retryDelayOnFailover: config?.retryDelayOnFailover,

      ...config,
    });
  }

  public isReady(): boolean {
    return this.isConnected && this.redis !== null;
  }

  public async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Get Redis info for monitoring
   */
  public async getInfo(): Promise<any> {
    if (!this.redis) return null;
    
    const info = await this.redis.info();
    return this.parseRedisInfo(info);
  }

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

export default RedisManager
