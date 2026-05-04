import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheTTL } from '../../common/cache/cacheTTL';
import { CacheService } from '../../common/providers/cache.service';
import { REDIS } from '../../common/providers/redis.provider';

@Injectable()
export class QuotesCacheProvider {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    @Inject(REDIS) private redis: Redis,
  ) {}

  // =========================
  // 🔑 KEYS
  // =========================

  getVendorRequestQuotesKey(
    vendorId: number,
    requestId: number,
    page: number,
    limit: number,
  ) {
    return `vendor:${vendorId}:request:${requestId}:quotes:page=${page}:limit=${limit}`;
  }

  getAgentQuotesKey(
    agentId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return `agent:${agentId}:quotes:status=${status}:page=${page}:limit=${limit}`;
  }

  // =========================
  // 📥 GET
  // =========================

  async getVendorRequestQuotes(
    vendorId: number,
    requestId: number,
    page: number,
    limit: number,
  ) {
    return this.cacheManager.get(
      this.getVendorRequestQuotesKey(vendorId, requestId, page, limit),
    );
  }

  async getAgentQuotes(
    agentId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return this.cacheManager.get(
      this.getAgentQuotesKey(agentId, page, limit, status),
    );
  }

  // =========================
  // 📤 SET
  // =========================

  async setVendorRequestQuotes(
    vendorId: number,
    requestId: number,
    page: number,
    limit: number,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getVendorRequestQuotesKey(vendorId, requestId, page, limit),
      data,
      CacheTTL.DeliveryRequests,
    );
  }

  async setAgentQuotes(
    agentId: number,
    page: number,
    limit: number,
    status: string,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getAgentQuotesKey(agentId, page, limit, status),
      data,
      CacheTTL.DeliveryRequests,
    );
  }

  // =========================
  // ❌ INVALIDATION
  // =========================

  async invalidateVendorRequestQuotes(vendorId: number, requestId: number) {
    const keys = await this.redis.keys(
      `vendor:${vendorId}:request:${requestId}:quotes:*`,
    );
    if (keys.length) await this.redis.del(keys);
  }

  async invalidateAgentQuotes(agentId: number) {
    const keys = await this.redis.keys(`agent:${agentId}:quotes:*`);
    if (keys.length) await this.redis.del(keys);
  }
}