import { Inject, Injectable } from '@nestjs/common';
import { REDIS } from './redis.provider';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS) private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string) {
    await this.redis.del(key);
  }
}
