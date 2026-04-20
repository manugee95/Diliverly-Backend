import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { CacheTTL } from 'src/common/cache/cacheTTL';
import { CacheService } from 'src/common/providers/cache.service';
import Redis from 'ioredis';
import { REDIS } from 'src/common/providers/redis.provider';

@Injectable()
export class DeliveryRequestsCacheProvider {
  constructor(
    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    @Inject(REDIS) private redis: Redis,
  ) {}

  getRequestsKey(agentId: number, page: number, limit: number) {
    return `agent:${agentId}:requests:page=${page}:limit=${limit}`;
  }

  async getRequests(agentId: number, page: number, limit: number) {
    return this.cacheManager.get(this.getRequestsKey(agentId, page, limit));
  }

  async setRequests(agentId: number, page: number, limit: number, data: any) {
    return this.cacheManager.set(
      this.getRequestsKey(agentId, page, limit),
      data,
      CacheTTL.AgentOrders,
    );
  }

  async invalidateAgent(agentId: number) {
    const keys = await this.redis.keys(`agent:${agentId}:requests:*`);
    if (keys.length) {
      await this.redis.del(keys);
    }
  }

  getVendorRequestsKey(
    vendorId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return `vendor:${vendorId}:requests:page=${page}:limit=${limit}:status=${status}`;
  }

  async getVendorRequests(
    vendorId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return this.cacheManager.get(
      this.getVendorRequestsKey(vendorId, page, limit, status),
    );
  }

  async setVendorRequests(
    vendorId: number,
    page: number,
    limit: number,
    status: string,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getVendorRequestsKey(vendorId, page, limit, status),
      data,
      CacheTTL.VendorOrders,
    );
  }

  async invalidateVendor(vendorId: number) {
    const keys = await this.redis.keys(`vendor:${vendorId}:requests:*`);
    if (keys.length) {
      await this.redis.del(keys);
    }
  }

  getAgentAssignedRequestsKey(agentId: number, page: number, limit: number) {
    return `agent:${agentId}:assigned-requests:page=${page}:limit=${limit}`;
  }

  async getAgentAssignedRequests(agentId: number, page: number, limit: number) {
    return this.cacheManager.get(
      this.getAgentAssignedRequestsKey(agentId, page, limit),
    );
  }

  async setAgentAssignedRequests(
    agentId: number,
    page: number,
    limit: number,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getAgentAssignedRequestsKey(agentId, page, limit),
      data,
      CacheTTL.AgentOrders,
    );
  }

  async invalidateAgentAssignedRequests(agentId: number) {
    const keys = await this.redis.keys(`agent:${agentId}:assigned-requests:*`);

    if (keys.length) {
      await this.redis.del(keys);
    }
  }
}
