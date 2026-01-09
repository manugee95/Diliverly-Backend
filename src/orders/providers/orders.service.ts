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
    // Validate vendor
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    const payment = await this.paymentRepo.findOne({
      where: { reference: dto.paymentReference, vendor: { id: vendor.id } },
      relations: ['deliveryRequest'],
    });
    if (!payment) throw new BadRequestException('Invalid payment');

    return await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(DeliveryRequest);
      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);

      // Load full request with quote relations
      const request = await requestRepo.findOne({
        where: { id: payment.deliveryRequest.id },
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

      // Find the order created during payment verify
      const order = await orderRepo.findOne({
        where: { request: { id: request.id }, vendor: { id: vendor.id } },
        relations: ['items'],
      });

      if (!order) throw new BadRequestException('Order not found');

      // Validate count
      if (dto.items.length !== request.deliveries.length) {
        throw new BadRequestException(
          `Items count must equal number of deliveries (${request.deliveries.length})`,
        );
      }

      const itemsToSave: OrderItem[] = [];

      for (let i = 0; i < request.deliveries.length; i++) {
        const delivery = request.deliveries[i];
        const item = dto.items[i];

        const dcEntry = acceptedQuote.deliveryCost.find(
          (dc) => dc.delivery.id === delivery.id,
        );
        if (!dcEntry)
          throw new BadRequestException(
            `No cost found for delivery ${delivery.id}`,
          );

        // Generate unique 4-digit pin
        const deliveryPin = await this.generateDeliveryPin();

        const orderItem = orderItemRepo.create({
          order: { id: order.id },
          delivery: { id: delivery.id },
          agent: { id: assignedAgent.id },
          itemName: item.itemName,
          quantity: item.quantity,
          buyerName: item.buyerName,
          buyerPhone: item.buyerPhone,
          deliveryType: delivery.deliveryType,
          cost: dcEntry.cost,
          codAmount: item.codAmount,
          deliveryPin,
        });

        itemsToSave.push(orderItem);
      }

      // Save all items
      await orderItemRepo.save(itemsToSave);

      // Update order status → ACTIVE
      await orderRepo.update(order.id, { status: OrderStatus.ACTIVE });

      return {
        message: 'Order items saved successfully',
        agentId: assignedAgent.id,
        orderRef: order.reference,
      };
    });
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

  /**
   * Method to Handle prepaid delivery
   */
  private async handlePrepaidDelivery(orderItem: OrderItem) {
    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);
      const userRepo = manager.getRepository(User);
      const agentRepo = manager.getRepository(Agent);

      const agent = await agentRepo.findOne({
        where: { id: orderItem.agent.id },
        relations: ['user'],
      });

      if (!agent) throw new Error('Agent not found');

      // Update status
      orderItem.status = OrderStatus.DELIVERED;
      await oiRepo.save(orderItem);

      // Auto-complete order
      await this.autoCompleteOrder(orderItem.order.id, manager);

      // Commission logic
      const cost = Number(orderItem.cost);
      const commission = cost * 0.1;
      const agentEarning = cost - commission;

      // Update wallet
      agent.user.walletBalance =
        Number(agent.user.walletBalance) + agentEarning;
      await userRepo.save(agent.user);

      // Create transaction record
      await this.txService.logTransaction({
        user: agent.user,
        type: TransactionType.CREDIT,
        amount: orderItem.cost * 0.9,
        description: `Prepaid delivery completed for item in order #${orderItem.order.reference}`,
        orderItem,
        reference: this.reference.generateTransactionRef(),
        status: TransactionStatus.SUCCESSFUL,
      });
    });

    return { message: 'Delivered successfully. Agent credited.' };
  }

  /**
   * Method to mark order item as delivered
   */
  async markDelivered(userId: number, dto: MarkDeliveredDto) {
    const { orderItemId, deliveryPin, paymentReceiptUrl } = dto;

    const agentUser = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    const orderItem = await this.orderItemRepo.findOne({
      where: { id: orderItemId },
      relations: [
        'order',
        'order.vendor',
        'order.vendor.user',
        'order.request',
        'agent',
      ],
    });

    if (!orderItem) throw new NotFoundException('Order item not found');

    if (!orderItem.agent || orderItem.agent.id !== agentUser?.id) {
      throw new UnauthorizedException('This delivery does not belong to you.');
    }

    // Allowed statuses:
    // - IN_PROGRESS = first delivery attempt
    // - DECLINED = vendor rejected receipt, agent re-submitting
    const allowed = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];

    if (!allowed.includes(orderItem.status)) {
      throw new BadRequestException('Order item already processed');
    }

    if (orderItem.deliveryPin !== deliveryPin) {
      throw new BadRequestException('Invalid delivery PIN');
    }

    if (orderItem.deliveryType === DeliveryType.PREPAID) {
      return await this.handlePrepaidDelivery(orderItem);
    }

    // CoD
    if (!paymentReceiptUrl) {
      throw new BadRequestException(
        'Payment receipt is required for CoD delivery',
      );
    }

    orderItem.paymentReceiptUrl = paymentReceiptUrl;
    orderItem.status = OrderStatus.PENDING_VENDOR_APPROVAL;

    await this.orderItemRepo.save(orderItem);

    return {
      message: 'Delivery submitted. Vendor approval required.',
    };
  }

  /**
   * Method to pay agent for cod
   */
  private async payAgentForCOD(orderItem: OrderItem) {
    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);
      const userRepo = manager.getRepository(User);
      const agentRepo = manager.getRepository(Agent);

      // Load agent WITH user relation
      const agent = await agentRepo.findOne({
        where: { id: orderItem.agent.id },
        relations: ['user'],
      });

      if (!agent) throw new Error('Agent not found');

      // Mark delivered
      orderItem.status = OrderStatus.DELIVERED;
      await oiRepo.save(orderItem);

      // check and auto-complete order
      await this.autoCompleteOrder(orderItem.order.id, manager);

      // Commission logic
      const cost = Number(orderItem.cost);
      const commission = cost * 0.1;
      const agentEarning = cost - commission;

      // Update wallet
      agent.user.walletBalance =
        Number(agent.user.walletBalance) + agentEarning;
      await userRepo.save(agent.user);

      // Create transaction record
      await this.txService.logTransaction({
        user: agent.user,
        type: TransactionType.CREDIT,
        amount: orderItem.cost * 0.9,
        description: `COD approved for item in order #${orderItem.order.reference}`,
        orderItem,
        reference: this.reference.generateTransactionRef(),
        status: TransactionStatus.SUCCESSFUL,
      });
    });

    return { message: 'Approved. Money released to agent.' };
  }

  /**
   * Method to approve cod delivery
   */
  async codVendorDecision(userId: number, dto: VendorDecisionDto) {
    const { orderItemId, approve } = dto;

    let vendorUser = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    const orderItem = await this.orderItemRepo.findOne({
      where: { id: orderItemId },
      relations: ['order', 'order.vendor', 'order.vendor.user', 'agent'],
    });

    if (!orderItem) throw new NotFoundException('Order item not found');

    if (orderItem.order.vendor.id !== vendorUser?.id) {
      throw new UnauthorizedException('Not your order');
    }

    if (orderItem.status !== OrderStatus.PENDING_VENDOR_APPROVAL) {
      throw new BadRequestException(
        'This delivery is not awaiting your approval',
      );
    }

    if (!approve) {
      orderItem.status = OrderStatus.DECLINED;
      await this.orderItemRepo.save(orderItem);

      return { message: 'Vendor declined. Payment remains in escrow.' };
    }

    return await this.payAgentForCOD(orderItem);
  }

  /**
   * Method to cancel an order Item
   */
  async cancelOrderItem(userId: number, dto: CancelOrderItemDto) {
    const { orderItemId } = dto;

    let agentUser = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    const orderItem = await this.orderItemRepo.findOne({
      where: { id: orderItemId },
      relations: ['order', 'order.vendor', 'order.vendor.user', 'agent'],
    });

    if (!orderItem) throw new NotFoundException('Order item not found');

    if (orderItem.agent.id !== agentUser?.id) {
      throw new UnauthorizedException('You cannot cancel this order');
    }

    // Allowed statuses:
    // - IN_PROGRESS = first delivery attempt
    // - DECLINED = vendor rejected receipt, agent re-submitting
    const allowed = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];

    if (!allowed.includes(orderItem.status)) {
      throw new BadRequestException(
        'Only IN_PROGRESS and DECLINED items can be cancelled',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);
      const userRepo = manager.getRepository(User);

      const vendorUser = await userRepo.findOne({
        where: { id: orderItem.order.vendor.user.id },
      });

      if (!vendorUser) throw new Error('Vendor user not found');

      vendorUser.walletBalance =
        Number(vendorUser.walletBalance) + Number(orderItem.cost);

      await userRepo.save(vendorUser);

      orderItem.status = OrderStatus.CANCELLED;
      await oiRepo.save(orderItem);

      // check and auto-complete order
      await this.autoCompleteOrder(orderItem.order.id, manager);

      // Create transaction record for refund
      await this.txService.logTransaction({
        user: vendorUser,
        type: TransactionType.CREDIT,
        amount: orderItem.cost,
        description: `Refund for cancelled item in order #${orderItem.order.reference}`,
        orderItem,
        reference: this.reference.generateTransactionRef(),
        status: TransactionStatus.SUCCESSFUL,
      });
    });

    return { message: 'Order canceled. Vendor refunded.' };
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
}
