import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '../../common/providers/cache.service';

@Injectable()
export class DashboardCacheProvider {
  constructor(
    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,
  ) {} 

  async invalidateVendor(vendorId: number) {
    await this.cacheManager.del(`vendor-dashboard:${vendorId}`);
  }

  async invalidateAgent(agentId: number) {
    await this.cacheManager.del(`agent-dashboard:${agentId}`);
  }

  async invalidateBoth(vendorId: number, agentId: number) {
    await Promise.all([
      this.invalidateVendor(vendorId),
      this.invalidateAgent(agentId),
    ]);
  }
}
