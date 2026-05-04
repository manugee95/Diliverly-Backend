import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheTTL } from '../../common/cache/cacheTTL';
import { CacheService } from '../../common/providers/cache.service';
import { REDIS } from '../../common/providers/redis.provider';

@Injectable()
export class OrdersCacheProvider {
  constructor(
    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    @Inject(REDIS) private redis: Redis,
  ) {}

  getAgentOrdersKey(
    agentId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return `agent:${agentId}:requests:page=${page}:limit=${limit}:status=${status}`;
  }

  async getAgentOrders(
    agentId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return this.cacheManager.get(
      this.getAgentOrdersKey(agentId, page, limit, status),
    );
  }

  async setAgentOrders(
    agentId: number,
    page: number,
    limit: number,
    status: string,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getAgentOrdersKey(agentId, page, limit, status),
      data,
      CacheTTL.AgentOrders,
    );
  }

  async invalidateAgent(agentId: number) {
    const keys = await this.redis.keys(`agent:${agentId}:orders:*`);
    if (keys.length) {
      await this.redis.del(keys);
    }
  }

  getVendorOrdersKey(
    vendorId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return `vendor:${vendorId}:orders:page=${page}:limit=${limit}:status=${status}`;
  }

  async getVendorOrders(
    vendorId: number,
    page: number,
    limit: number,
    status: string,
  ) {
    return this.cacheManager.get(
      this.getVendorOrdersKey(vendorId, page, limit, status),
    );
  }

  async setVendorOrders(
    vendorId: number,
    page: number,
    limit: number,
    status: string,
    data: any,
  ) {
    return this.cacheManager.set(
      this.getVendorOrdersKey(vendorId, page, limit, status),
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

  getOrderItemsKey(orderId: number) {
    return `order:${orderId}:items`;
  }

  async getOrderItems(orderId: number) {
    return this.cacheManager.get(this.getOrderItemsKey(orderId));
  }

  async setOrderItems(orderId: number, data: any) {
    return this.cacheManager.set(
      this.getOrderItemsKey(orderId),
      data,
      CacheTTL.VendorOrders,
    );
  }

  async invalidateOrderItems(orderId: number) {
    await this.cacheManager.del(this.getOrderItemsKey(orderId));
  }
}
