import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import Redis from 'ioredis';
import { CacheService } from '../../common/providers/cache.service';
import { REDIS } from '../../common/providers/redis.provider';
import { CacheTTL } from '../../common/cache/cacheTTL';

@Injectable()
export class FavoritesCacheProvider {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    @Inject(REDIS) private redis: Redis,
  ) {}

  // =========================
  // KEY
  // =========================
  getVendorFavoritesKey(
    vendorId: number,
    page: number,
    limit: number,
  ) {
    return `vendor:${vendorId}:favorites:page=${page}:limit=${limit}`;
  }

  // =========================
  // GET
  // =========================
  async getVendorFavorites(
    vendorId: number,
    page: number,
    limit: number,
  ) {
    return this.cacheManager.get(
      this.getVendorFavoritesKey(vendorId, page, limit),
    );
  }

  // =========================
  // SET
  // =========================
  async setVendorFavorites(
    vendorId: number,
    page: number,
    limit: number,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getVendorFavoritesKey(vendorId, page, limit),
      data,
      CacheTTL.AgentOrders, // define e.g. 60s
    );
  }

  // =========================
  // INVALIDATE
  // =========================
  async invalidateVendorFavorites(vendorId: number) {
    const keys = await this.redis.keys(
      `vendor:${vendorId}:favorites:*`,
    );
    if (keys.length) {
      await this.redis.del(keys);
    }
  }
}
