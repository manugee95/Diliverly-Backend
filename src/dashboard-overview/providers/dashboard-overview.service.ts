import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { In, Repository } from 'typeorm';
import { Agent } from '../../agent/agent.entity';

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
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,

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
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    /**
     * Total Delivery Requests
     */
    const totalDeliveryRequests = await this.deliveryRequestRepo.count({
      where: {
        vendor: {
          id: vendor.id,
        },
      },
    });

    /**
     * Total Active Orders
     */
    const totalActiveOrders = await this.orderRepo.count({
      where: {
        vendor: {
          id: vendor.id,
        },
        status: OrderStatus.ACTIVE,
      },
    });

    /**
     * Total Completed Orders
     */
    const totalCompletedOrders = await this.orderRepo.count({
      where: {
        vendor: {
          id: vendor.id,
        },
        status: OrderStatus.COMPLETE,
      },
    });

    /**
     * Total Pending Quotes
     *
     * Quotes attached to this vendor's requests
     */
    const totalPendingQuotes = await this.quoteRepo
      .createQueryBuilder('quote')
      .innerJoin('quote.request', 'request')
      .where('request.vendorId = :vendorId', {
        vendorId: vendor.id,
      })
      .andWhere('quote.status = :status', {
        status: QuoteStatus.ACCEPTED,
      })
      .getCount();

    return {
      totalDeliveryRequests,
      totalActiveOrders,
      totalCompletedOrders,
      totalPendingQuotes,
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
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const statesCovered = agent.statesCovered ?? [];

    if (!statesCovered.length) {
      throw new BadRequestException('No states covered by this agent');
    }

    /**
     * Total Available Delivery Requests
     */
    const totalAvailableDeliveryRequests = await this.deliveryRequestRepo.count(
      {
        where: [
          {
            state: In(statesCovered),
            status: RequestStatus.OPEN,
            isDirect: false,
          },
          {
            state: In(statesCovered),
            status: RequestStatus.OPEN,
            isDirect: true,
            assignedAgent: {
              id: agent.id,
            },
          },
        ],
      },
    );

    /**
     * Total Quotes Sent
     */
    const totalQuotesSent = await this.quoteRepo.count({
      where: {
        agent: {
          id: agent.id,
        },
      },
    });

    /**
     * Total Active Orders
     */
    const totalActiveOrders = await this.orderRepo
      .createQueryBuilder('order')
      .innerJoin('order.items', 'item')
      .where('item.agentId = :agentId', {
        agentId: agent.id,
      })
      .andWhere('order.status = :status', {
        status: OrderStatus.ACTIVE,
      })
      .distinct(true)
      .getCount();

    /**
     * Total Delivered Items
     */
    const totalDeliveredItems = await this.orderItemRepo.count({
      where: {
        agent: {
          id: agent.id,
        },
        status: OrderStatus.DELIVERED,
      },
    });

    return {
      totalAvailableDeliveryRequests,
      totalQuotesSent,
      totalActiveOrders,
      totalDeliveredItems,
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
