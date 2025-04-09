import Redis, { type RedisOptions } from 'ioredis';

class RedisClient {
  private static instance: Redis;

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      const REDIS_HOST = process.env.REDISHOST || 'localhost';
      const REDIS_PORT = process.env.REDISPORT || 6379;
      const options: RedisOptions = {
        host: REDIS_HOST,
        port: Number(REDIS_PORT)
      };
      RedisClient.instance = new Redis(options);

      RedisClient.instance.on('connect', () => {
        console.log('Connected to Redis');
      });
      RedisClient.instance.on('error', (err) => {
        console.error('Redis error:', err);
      });
      console.log(`Redis status: ${RedisClient.instance.status}`);
    }
    return RedisClient.instance;
  }

  public static async get(key: string): Promise<string | null> {
    const client = this.getInstance();
    return client.get(key);
  }

  public static async set(key: string, value: string, expirySeconds?: number): Promise<string> {
    const client = this.getInstance();
    if (expirySeconds) {
      return client.set(key, value, 'EX', expirySeconds);
    }
    return client.set(key, value);
  }

  public static async del(key: string): Promise<number> {
    const client = this.getInstance();
    return client.del(key);
  }
}

export default RedisClient;
