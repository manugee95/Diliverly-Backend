import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS = 'REDIS';

export const redisProvider: Provider = {
  provide: REDIS,
  useFactory: () => {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not defined');
    }
    return new Redis(process.env.REDIS_URL as string);
  },
};
