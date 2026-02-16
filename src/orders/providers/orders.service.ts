import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Vendor } from 'src/vendor/vendor.entity';
import { EntityManager, Repository } from 'typeorm';
import { CreateOrderDto } from '../dtos/createOrder.dto';
import { Payment } from 'src/payments/payment.entity';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { QuoteStatus } from 'src/quotes/enums/quoteStatus.enum';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/orderItem.entity';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from 'src/common/providers/cache.service';
import { CacheTTL } from 'src/common/cache/cacheTTL';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { GetOrdersDto } from '../dtos/getOrders.dto';
import { OrderStatus } from '../enums/orderStatus.enum';
import { MarkDeliveredDto } from '../dtos/markDelivered.dto';
import { User } from 'src/users/user.entity';
import { DeliveryType } from 'src/delivery-requests/enums/deliveryType.enum';
import { VendorDecisionDto } from '../dtos/vendorDecision.dto';
import { CancelOrderItemDto } from '../dtos/cancelOrderItem.dto';
import { Transaction } from 'src/transactions/transaction.entity';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import { Agent } from 'src/agent/agent.entity';
import { Wallet } from 'src/wallets/entities/wallet.entity';
import { EscrowStatus } from 'src/escrow/enums/escrowStatus.enum';
import { Escrow } from 'src/escrow/escrow.entity';
import { EscrowService } from 'src/escrow/providers/escrow.service';

@Injectable()
export class OrdersService {
  constructor(
    /**
     * Injecting Vendor Repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Injecting Payment Repository
     */
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    /**
     * Injecting Data Source
     */
    private readonly dataSource: DataSource,

    /**
     * Injecting Order Repository
     */
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    /**
     * Injecting Order Item Repository
     */
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    /**
     * Inject Agent Repository
     */
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,

    /**
     * Inject Transaction Repository
     */
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    /**
     * Injecting Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Injecting Transaction Service
     */
    private readonly txService: TransactionsService,

    /**
     * Injecting Reference Provider
     */
    private readonly reference: ReferenceProvider,

    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    /** Inject Escrow Service */
    private readonly escrowService: EscrowService,
  ) {}

  /**
   * Method to generate delivery codes for order items
   */
  private generateDeliveryPin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Method to create order items for an order
   */
  async createOrderItem(userId: number, dto: CreateOrderDto) {
    // Find the vendor
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    return await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(DeliveryRequest);
      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);

      // 1) Lock request row WITHOUT relations (safe)
      const lockedRequest = await requestRepo.findOne({
        where: { id: dto.requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRequest) throw new BadRequestException('Request not found');

      // 2) Load request graph WITHOUT lock (relations cause LEFT JOIN)
      const request = await requestRepo.findOne({
        where: { id: dto.requestId },
        relations: [
          'deliveries',
          'quotes',
          'quotes.deliveryCost',
          'quotes.deliveryCost.delivery',
          'quotes.agent',
        ],
      });
      if (!request) throw new BadRequestException('Request not found');

      const acceptedQuote = request.quotes.find(
        (q) => q.status === QuoteStatus.ACCEPTED,
      );
      if (!acceptedQuote)
        throw new BadRequestException('No accepted quote found');

      const assignedAgent = acceptedQuote.agent;
      if (!assignedAgent)
        throw new BadRequestException('Quote has no assigned agent');

      // 3) Lock order row WITHOUT relations (safe)
      const order = await orderRepo.findOne({
        where: { request: { id: request.id }, vendor: { id: vendor.id } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new BadRequestException('Order not found');

      // 4) Load existing placeholder items (NO lock; order row is already locked)
      const existingItems = await orderItemRepo.find({
        where: { order: { id: order.id } },
        relations: ['delivery'], // only for mapping by delivery.id
      });

      if (!existingItems.length) {
        throw new BadRequestException(
          'Order items not found. Expected placeholders to already exist.',
        );
      }

      // Validate count (vendor must provide details for each delivery)
      if (dto.items.length !== request.deliveries.length) {
        throw new BadRequestException(
          `Items count must equal number of deliveries (${request.deliveries.length})`,
        );
      }

      if (existingItems.length !== request.deliveries.length) {
        throw new BadRequestException(
          `Placeholder items mismatch. Expected ${request.deliveries.length} but found ${existingItems.length}.`,
        );
      }

      // 5) Build maps for correct matching (don’t rely on array order)
      const existingByDeliveryId = new Map<number, OrderItem>();
      for (const oi of existingItems) {
        const did = oi.delivery?.id;
        if (did) existingByDeliveryId.set(did, oi);
      }

      if (existingByDeliveryId.size !== request.deliveries.length) {
        throw new BadRequestException(
          'Placeholders are missing delivery links. Ensure each OrderItem is created with a delivery.',
        );
      }

      const toSave: OrderItem[] = [];

      for (let i = 0; i < request.deliveries.length; i++) {
        const delivery = request.deliveries[i];
        const input = dto.items[i];

        const target = existingByDeliveryId.get(delivery.id);
        if (!target) {
          throw new BadRequestException(
            `Missing placeholder order item for delivery ${delivery.id}`,
          );
        }

        // Optional: ensure cost exists for this delivery in the accepted quote
        const dcEntry = acceptedQuote.deliveryCost.find(
          (dc) => dc.delivery.id === delivery.id,
        );
        if (!dcEntry) {
          throw new BadRequestException(
            `No cost found for delivery ${delivery.id}`,
          );
        }

        // Vendor fills correct info
        target.itemName = input.itemName;
        target.quantity = input.quantity;
        target.buyerName = input.buyerName;
        target.buyerPhone = input.buyerPhone;
        target.codAmount = input.codAmount ?? 0;
        target.deliveryPin = await this.generateDeliveryPin();
        target.status = OrderStatus.IN_PROGRESS;

        toSave.push(target);
      }

      await orderItemRepo.save(toSave);

      // Mark order ACTIVE after vendor completes details
      await orderRepo.update(order.id, { status: OrderStatus.ACTIVE });

      return {
        message: 'Order items updated successfully',
        agentId: assignedAgent.id,
        orderRef: order.reference,
      };
    });
  }

  /**
   * Method to Handle prepaid delivery
   */
  private async handlePrepaidDelivery(orderItem: OrderItem) {
    // Execute within transaction
    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);

      // 1) Lock OrderItem row WITHOUT relations (safe)
      const lockedOI = await oiRepo.findOne({
        where: { id: orderItem.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedOI) throw new Error('Order item not found');

      // 2) Load orderItem graph WITHOUT lock (relations cause LEFT JOIN)
      const oi = await oiRepo.findOne({
        where: { id: orderItem.id },
        relations: [
          'order',
          'order.vendor',
          'order.vendor.user',
          'agent',
          'agent.user',
        ],
      });

      if (!oi) throw new Error('Order item not found');


      // Update status to DELIVERED
      oi.status = OrderStatus.DELIVERED;
      await oiRepo.save(oi);

      // Release escrow via EscrowService (uses same manager/tx)
      await this.escrowService.releaseToAgent(oi.id, manager);

      // Auto-complete order (if all items done)
      await this.autoCompleteOrder(oi.order.id, manager);
    });

    return { message: 'Delivered successfully. Escrow released to agent.' };
  }

  /**
   * Method to mark order item as delivered
   */
  async markDelivered(userId: number, dto: MarkDeliveredDto) {
  const { orderItemId, deliveryPin } = dto;

  // Find agent profile
  const agentUser = await this.agentRepo.findOne({
    where: { user: { id: userId } },
  });
  if (!agentUser) throw new UnauthorizedException('Agent not found');

  // Light fetch (no need to load huge graph here)
  const orderItem = await this.orderItemRepo.findOne({
    where: { id: orderItemId },
    relations: ['agent', 'agent.user'], // enough to verify ownership + pin
  });

  if (!orderItem) throw new NotFoundException('Order item not found');

  if (!orderItem.agent || orderItem.agent.id !== agentUser.id) {
    throw new UnauthorizedException('This delivery does not belong to you.');
  }

  const allowed = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];
  if (!allowed.includes(orderItem.status)) {
    throw new BadRequestException('Order item already processed');
  }

  if (orderItem.deliveryPin !== deliveryPin) {
    throw new BadRequestException('Invalid delivery PIN');
  }

  // =========================
  // PREPAID => deliver + release escrow now
  // =========================
  if (orderItem.deliveryType === DeliveryType.PREPAID) {
    return await this.handlePrepaidDelivery(orderItem);
  }

  // =========================
  // COD => settle COD from agent wallet + release escrow
  // =========================
  if (!orderItem.codAmount || Number(orderItem.codAmount) <= 0) {
    throw new BadRequestException('COD amount not set by vendor');
  }

  await this.dataSource.transaction(async (manager) => {
    const oiRepo = manager.getRepository(OrderItem);
    const walletRepo = manager.getRepository(Wallet);
    const userRepo = manager.getRepository(User);
    const escrowRepo = manager.getRepository(Escrow);

    // STEP 1: Lock OrderItem WITHOUT relations (avoids LEFT JOIN + FOR UPDATE)
    const lockedOI = await oiRepo.findOne({
      where: { id: orderItemId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!lockedOI) throw new Error('Order item not found');

    // STEP 2: Load full graph WITHOUT lock
    const oi = await oiRepo.findOne({
      where: { id: orderItemId },
      relations: ['order', 'order.vendor', 'order.vendor.user', 'agent', 'agent.user'],
    });

    if (!oi) throw new Error('Order item not found');

    // Re-check ownership inside TX (safe)
    if (!oi.agent || oi.agent.id !== agentUser.id) {
      throw new UnauthorizedException('This delivery does not belong to you.');
    }

    // Re-check status inside TX
    const allowedInTx = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];
    if (!allowedInTx.includes(oi.status)) {
      throw new BadRequestException('Order item already processed');
    }

    // Re-check PIN inside TX
    if (oi.deliveryPin !== deliveryPin) {
      throw new BadRequestException('Invalid delivery PIN');
    }

    // Lock escrow row
    const escrow = await escrowRepo.findOne({
      where: { reference: `ESCROW-OI-${oi.id}` },
      lock: { mode: 'pessimistic_write' },
    });

    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== EscrowStatus.HELD) {
      throw new BadRequestException('Escrow already processed for this item');
    }

    const codAmount = Number(oi.codAmount);
    if (!Number.isFinite(codAmount) || codAmount <= 0) {
      throw new BadRequestException('Invalid COD amount');
    }

    const agentUserId = oi.agent?.user?.id;
    const vendorUserId = oi.order?.vendor?.user?.id;

    if (!agentUserId) throw new Error('Agent user not found');
    if (!vendorUserId) throw new Error('Vendor user not found');

    // Lock wallets
    const agentWallet = await walletRepo.findOne({
      where: { user: { id: agentUserId } },
      lock: { mode: 'pessimistic_write' },
    });

    const vendorWallet = await walletRepo.findOne({
      where: { user: { id: vendorUserId } },
      lock: { mode: 'pessimistic_write' },
    });

    if (!agentWallet) throw new Error('Agent wallet not found');
    if (!vendorWallet) throw new Error('Vendor wallet not found');

    if (Number(agentWallet.availableBalance) < codAmount) {
      throw new BadRequestException(
        'Insufficient wallet balance to settle COD, Fund your wallet and try again.',
      );
    }

    // (1) COD settlement: agent -> vendor
    agentWallet.availableBalance = (
      Number(agentWallet.availableBalance) - codAmount
    ).toFixed(2);

    vendorWallet.availableBalance = (
      Number(vendorWallet.availableBalance) + codAmount
    ).toFixed(2);

    await walletRepo.save([agentWallet, vendorWallet]);

    // (2) update status to delivered
    oi.status = OrderStatus.DELIVERED;
    await oiRepo.save(oi);

    // (3) Release delivery fee to agent
    await this.escrowService.releaseToAgent(oi.id, manager);

    // (4) Auto-complete order
    await this.autoCompleteOrder(oi.order.id, manager);

    // (5) Log COD transactions
    const agentUserEntity = await userRepo.findOne({ where: { id: agentUserId } });
    const vendorUserEntity = await userRepo.findOne({ where: { id: vendorUserId } });

    if (agentUserEntity) {
      await this.txService.logTransaction(
        {
          user: agentUserEntity,
          type: TransactionType.DEBIT,
          amount: codAmount,
          description: `COD paid to vendor for order #${oi.order.reference}, item #${oi.id}`,
          orderItem: oi,
          reference: this.reference.generateTransactionRef(),
          status: TransactionStatus.SUCCESSFUL,
        },
        manager,
      );
    }

    if (vendorUserEntity) {
      await this.txService.logTransaction(
        {
          user: vendorUserEntity,
          type: TransactionType.CREDIT,
          amount: codAmount,
          description: `COD received from agent for order #${oi.order.reference}, item #${oi.id}`,
          orderItem: oi,
          reference: this.reference.generateTransactionRef(),
          status: TransactionStatus.SUCCESSFUL,
        },
        manager,
      );
    }
  });

  return {
    message: 'COD settled from wallet. order item marked as delivered.',
  };
}


  /**
   * Method to cancel an order Item
   */

  async cancelOrderItem(userId: number, dto: CancelOrderItemDto) {
    const { orderItemId } = dto;

    // Find agent user
    const agentUser = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    // Find order item with relations
    const orderItem = await this.orderItemRepo.findOne({
      where: { id: orderItemId },
      relations: [
        'order',
        'order.vendor',
        'order.vendor.user',
        'agent',
        'agent.user',
      ],
    });

    // Validate order item
    if (!orderItem) throw new NotFoundException('Order item not found');

    // Validate ownership
    if (orderItem.agent.id !== agentUser?.id) {
      throw new UnauthorizedException('You cannot cancel this order');
    }

    // Allowed statuses:
    // - IN_PROGRESS
    // - DECLINED
    const allowed = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];
    if (!allowed.includes(orderItem.status)) {
      throw new BadRequestException(
        'Only IN_PROGRESS and DECLINED items can be cancelled',
      );
    }

    // Execute cancellation within transaction
    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);

      // Re-fetch with lock to prevent double cancel
      const oi = await oiRepo.findOne({
        where: { id: orderItemId },
        relations: [
          'order',
          'order.vendor',
          'order.vendor.user',
          'agent',
          'agent.user',
        ],
        lock: { mode: 'pessimistic_write' },
      });

      if (!oi) throw new NotFoundException('Order item not found');

      // Mark order item cancelled
      oi.status = OrderStatus.CANCELLED;
      await oiRepo.save(oi);

      // Refund escrow via EscrowService (uses same manager/tx)
      await this.escrowService.refundToVendor(oi.id, manager);

      // auto-complete order
      await this.autoCompleteOrder(oi.order.id, manager);
    });

    return { message: 'Order canceled. Vendor refunded from escrow.' };
  }

  /**
   * Method to automatically mark order as completed
   */
  private async autoCompleteOrder(orderId: number, manager: EntityManager) {
    const orderRepo = manager.getRepository(Order);

    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) return;

    const allCompleted = order.items.every((item) =>
      [OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(item.status),
    );

    if (!allCompleted) return;

    if (order.status !== OrderStatus.COMPLETE) {
      order.status = OrderStatus.COMPLETE;
      order.completedAt = new Date();
      await orderRepo.save(order);

      console.log(`Order ${order.id} marked as COMPLETE automatically.`);
    }
  }

  /**
   * Method to get orders assigned to an agent
   */
  async getOrdersAssignedToAgent(userId: number, ordersQuery: GetOrdersDto) {
    //Find the agent
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!agent) throw new BadRequestException('Agent not found');

    // Check cache first
    const cacheKey = `agent:${agent.id}:orders`;

    const cached = await this.cacheManager.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    //If not in cache, fetch from DB
    const orders = await this.paginationProvider.paginateQuery(
      {
        page: ordersQuery.page || 1,
        limit: ordersQuery.limit || 10,
      },
      this.orderRepo,
      {
        where: {
          request: {
            quotes: {
              agent: {
                id: agent.id,
              },
            },
          },
        },
        relations: ['request', 'vendor'],
        order: { createdAt: 'DESC' },
      },
    );

    // Store in cache for future requests
    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(orders),
      CacheTTL.AgentOrders,
    );

    return orders;
  }

  /**
   * Method to get orders made by a vendor
   */
  async getOrdersForVendor(userId: number, ordersQuery: GetOrdersDto) {
    //Find the vendor
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    // Check cache first
    const cacheKey = `vendor:${vendor.id}:orders`;
    const cached = await this.cacheManager.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    //If not in cache, fetch from DB
    const orders = await this.paginationProvider.paginateQuery(
      {
        page: ordersQuery.page || 1,
        limit: ordersQuery.limit || 10,
      },
      this.orderRepo,
      {
        where: {
          vendor: { id: vendor.id },
        },
        relations: ['request', 'vendor'],
        order: { createdAt: 'DESC' },
      },
    );

    // Store in cache for future requests
    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(orders),
      CacheTTL.VendorOrders,
    );

    return orders;
  }

  /**
   * Method to get order Items for an order
   */
  async getOrderItems(orderId: number) {
    const cacheKey = `order:${orderId}:items`;

    // Check cache first
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from DB
    const items = await this.orderItemRepo.find({
      where: { order: { id: orderId } },
    });

    // Store in cache for future requests
    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(items),
      CacheTTL.VendorOrders,
    );

    return items;
  }
}
