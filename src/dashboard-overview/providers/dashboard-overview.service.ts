import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CacheService } from '../../common/providers/cache.service';
import { DeliveryRequest } from '../../delivery-requests/entities/delivery-request.entity';
import { RequestStatus } from '../../delivery-requests/enums/requestStatus.enum';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/orderItem.entity';
import { OrderStatus } from '../../orders/enums/orderStatus.enum';
import { Quote } from '../../quotes/entities/quote.entity';
import { QuoteStatus } from '../../quotes/enums/quoteStatus.enum';
import { Vendor } from '../../vendor/vendor.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DashboardOverviewService {
  constructor(
    /**
     * Inject Vendor Repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Inject DeliveryRequest Repository
     */
    @InjectRepository(DeliveryRequest)
    private readonly deliveryRequestRepo: Repository<DeliveryRequest>,

    /**
     * Inject Order Repository
     */
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    /**
     * Inject Quote Repository
     */
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    /**
     * Inject Agent Repository
     */
    @InjectRepository(Vendor)
    private readonly agentRepo: Repository<Vendor>,

    /**
     * Inject OrderItem Repository
     */
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,
  ) {}

  // Method to get vendor dashboard data
  private async buildVendorDashboard(userId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) throw new NotFoundException('Vendor not found');

    const result = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.request', 'request')
      .leftJoin('request.quotes', 'quote')
      .where('order.vendorId = :vendorId', { vendorId: vendor.id })
      .select([
        'COUNT(DISTINCT request.id) AS "totalDeliveryRequests"',

        `COUNT(DISTINCT CASE 
        WHEN order.status = :active 
        THEN order.id END) AS "totalActiveOrders"`,

        `COUNT(DISTINCT CASE 
        WHEN order.status = :completed 
        THEN order.id END) AS "totalCompletedOrders"`,

        `COUNT(DISTINCT CASE 
        WHEN quote.status = :pending 
        THEN quote.id END) AS "totalPendingQuotes"`,
      ])
      .setParameters({
        active: OrderStatus.IN_PROGRESS,
        completed: OrderStatus.COMPLETE,
        pending: QuoteStatus.PENDING,
      })
      .getRawOne();

    return {
      totalDeliveryRequests: Number(result.totalDeliveryRequests || 0),
      totalActiveOrders: Number(result.totalActiveOrders || 0),
      totalCompletedOrders: Number(result.totalCompletedOrders || 0),
      totalPendingQuotes: Number(result.totalPendingQuotes || 0),
    };
  }

  async getVendorDashboard(userId: number) {
    const cacheKey = `vendor-dashboard:${userId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.buildVendorDashboard(userId);

    await this.cacheManager.set(cacheKey, data, 60); // 60s

    return data;
  }

  // Method to get agent dashboard data
  private async buildAgentDashboard(userId: number) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) throw new NotFoundException('Agent not found');

    const result = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoin('item.order', 'order')
      .leftJoin('order.request', 'request')
      .leftJoin('request.quotes', 'quote')
      .select([
        `COUNT(DISTINCT CASE 
      WHEN request.status = :open 
      THEN request.id END) AS "totalAvailableDeliveryRequests"`,

        `COUNT(DISTINCT CASE 
      WHEN item.status = :active 
      THEN item.id END) AS "totalActiveOrders"`,

        `COUNT(DISTINCT CASE 
      WHEN quote.agentId = :agentId 
      THEN quote.id END) AS "totalQuotesSent"`,

        `COUNT(DISTINCT CASE 
      WHEN item.status = :delivered 
      THEN item.id END) AS "totalDeliveredItems"`,
      ])
      .setParameters({
        open: RequestStatus.OPEN,
        active: OrderStatus.IN_PROGRESS,
        delivered: OrderStatus.DELIVERED,
        agentId: agent.id,
      })
      .getRawOne();

    return {
      totalAvailableDeliveryRequests: Number(
        result.totalAvailableDeliveryRequests || 0,
      ),
      totalActiveOrders: Number(result.totalActiveOrders || 0),
      totalQuotesSent: Number(result.totalQuotesSent || 0),
      totalDeliveredItems: Number(result.totalDeliveredItems || 0),
    };
  }

  async getAgentDashboard(userId: number) {
    const cacheKey = `agent-dashboard:${userId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.buildAgentDashboard(userId);

    await this.cacheManager.set(cacheKey, data, 60);

    return data;
  }
}
