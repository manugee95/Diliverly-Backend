import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          url: `${process.env.REDIS_URL}`,
        }),
        ttl: 30_000, // default 30s – we will override per use case
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
