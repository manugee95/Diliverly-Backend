import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Vendor } from '../../vendor/vendor.entity';
import { EntityManager, Repository } from 'typeorm';
import { CreateOrderDto } from '../dtos/createOrder.dto';
import { DeliveryRequest } from '../../delivery-requests/entities/delivery-request.entity';
import { QuoteStatus } from '../../quotes/enums/quoteStatus.enum';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/orderItem.entity';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from '../../common/providers/cache.service';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';
import { GetOrdersDto } from '../dtos/getOrders.dto';
import { OrderStatus } from '../enums/orderStatus.enum';
import { MarkDeliveredDto } from '../dtos/markDelivered.dto';
import { User } from '../../users/user.entity';
import { DeliveryType } from '../../delivery-requests/enums/deliveryType.enum';
import { CancelOrderItemDto } from '../dtos/cancelOrderItem.dto';
import { TransactionType } from '../../transactions/enums/transactionType.enum';
import { TransactionsService } from '../../transactions/providers/transactions.service';
import { TransactionStatus } from '../../transactions/enums/transactionStatus.enum';
import { Agent } from '../../agent/agent.entity';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { EscrowStatus } from '../../escrow/enums/escrowStatus.enum';
import { Escrow } from '../../escrow/escrow.entity';
import { EscrowService } from '../../escrow/providers/escrow.service';
import { MailerService } from '../../mailer/providers/mailer.service';
import { RequestStatus } from '../../delivery-requests/enums/requestStatus.enum';
import { DashboardCacheProvider } from '../../dashboard-overview/providers/dashboard-overview.provider';
import { OrdersCacheProvider } from './orders.provider';
import { CurrencyConvertProvider } from '../../common/providers/currency-convert.provider';
import { generateTransactionRef } from '../../common/utils/reference.util';
import { calculateTrustScore } from '../../common/utils/trust-score.util';
import { RequestExtensionDto } from '../dtos/requestExtension.dto';
import { OrderTimeExtension } from '../entities/orderTimeExtension.entity';
import { ExtensionStatus } from '../enums/orderExtension.enum';

@Injectable()
export class OrdersService {
  constructor(
    /**
     * Injecting Vendor Repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

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
     * Inject Extension Repo
     */
    @InjectRepository(OrderTimeExtension)
    private readonly extensionRepo: Repository<OrderTimeExtension>,

    /**
     * Injecting Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Injecting Transaction Service
     */
    private readonly txService: TransactionsService,

    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    /** Inject Escrow Service */
    private readonly escrowService: EscrowService,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,

    /**
     * Injecting Dashboard Cache Provider
     */
    private readonly dashboardCacheProvider: DashboardCacheProvider,

    /**
     * Injecting Orders Cache Provider
     */
    private readonly ordersCacheProvider: OrdersCacheProvider,

    /**
     * Injecting currency convert provider
     */
    private readonly currencyConvert: CurrencyConvertProvider,
  ) {}

  /**
   * Method to generate delivery codes for order items
   */
  private generateDeliveryPin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Method to notify agent of new order assignment
   */
  private async notifyAgent(payload: {
    agentEmail: string;
    orderReference: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.agentEmail,
        'Your Order Has Started',
        'order-started',
        {
          orderReference: payload.orderReference,
        },
        `Your order ${payload.orderReference} has started`,
      );
    } catch (error) {
      console.error('Failed to send agent email:', error);
    }
  }

  /**
   * Method to notify agent of payment received
   */
  private async notifyAgentPaymentReceived(payload: {
    agentEmail: string;
    agentName: string;
    amount: number;
    reference: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.agentEmail,
        'Payment Received – Delivery Completed',
        'payment-received',
        {
          agentName: payload.agentName,
          amount: payload.amount,
          reference: payload.reference,
        },
        `You just earned ₦${payload.amount} for order ${payload.reference}`,
      );
    } catch (error) {
      console.error('Failed to send agent email:', error);
    }
  }

  /**
   * Method to notify vendor of item delivered
   */
  private async notifyVendorDelivered(payload: {
    vendorEmail: string;
    orderReference: string;
    vendorName: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.vendorEmail,
        'Item Delivered',
        'item-delivered',
        {
          orderReference: payload.orderReference,
          vendorName: payload.vendorName,
        },
        `An item in your order ${payload.orderReference} has been delivered!`,
      );
    } catch (error) {
      console.error('Failed to send vendor email:', error);
    }
  }

  /**
   * Method to notify vendor of order completed
   */
  private async notifyVendorCompleted(payload: {
    vendorEmail: string;
    orderReference: string;
    vendorName: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.vendorEmail,
        'Order Completed 🚀',
        'order-completed',
        {
          orderReference: payload.orderReference,
          vendorName: payload.vendorName,
        },
        `Your order ${payload.orderReference} has been completed!`,
      );
    } catch (error) {
      console.error('Failed to send vendor email:', error);
    }
  }

  /**
   * Method to notify vendor of item cancelled
   */
  private async notifyVendorCancelled(payload: {
    vendorEmail: string;
    orderReference: string;
    vendorName: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.vendorEmail,
        'Item Cancelled',
        'item-cancelled',
        {
          orderReference: payload.orderReference,
          vendorName: payload.vendorName,
        },
        `An item in your order ${payload.orderReference} has been cancelled.`,
      );
    } catch (error) {
      console.error('Failed to send vendor email:', error);
    }
  }

  /**
   * Method to notify vendor of COD Payment received
   */
  private async notifyVendorCodPayment(payload: {
    vendorEmail: string;
    orderReference: string;
    vendorName: string;
    amountPaid: number;
    deliveryItem: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.vendorEmail,
        'COD Payment Received',
        'cod-payment',
        {
          orderReference: payload.orderReference,
          vendorName: payload.vendorName,
          amountPaid: payload.amountPaid,
          deliveryItem: payload.deliveryItem,
        },
        `You just received a COD payment of ₦${payload.amountPaid}`,
      );
    } catch (error) {
      console.error('Failed to send vendor email:', error);
    }
  }

  /**
   * Method to notify vendor to provide delivery details
   */
  private async notifyVendorReminder(payload: {
    vendorEmail: string;
    orderReference: string;
    vendorName: string;
    orderUrl: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.vendorEmail,
        `Reminder: Provide Delivery Details for Order ${payload.orderReference}`,
        'send-reminder',
        {
          orderReference: payload.orderReference,
          vendorName: payload.vendorName,
          orderUrl: payload.orderUrl,
        },
        `Please provide delivery details for your order to get started`,
      );
    } catch (error) {
      console.error('Failed to send vendor email:', error);
    }
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
          'quotes.agent.user',
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

      //Load order with relations to ensure correct locking (important for step 4)
      const orderWithRelations = await orderRepo.findOne({
        where: { id: order.id },
        relations: ['vendor', 'request'],
      });

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

      // Build input map by deliveryId
      const inputByDeliveryId = new Map<number, (typeof dto.items)[0]>();

      for (const item of dto.items) {
        if (!item.deliveryId) {
          throw new BadRequestException('deliveryId is required for each item');
        }

        if (inputByDeliveryId.has(item.deliveryId)) {
          throw new BadRequestException(
            `Duplicate deliveryId ${item.deliveryId} in payload`,
          );
        }

        inputByDeliveryId.set(item.deliveryId, item);
      }

      if (inputByDeliveryId.size !== request.deliveries.length) {
        throw new BadRequestException(
          `All deliveries must be provided. Expected ${request.deliveries.length}, got ${inputByDeliveryId.size}`,
        );
      }

      const toSave: OrderItem[] = [];

      for (const delivery of request.deliveries) {
        const input = inputByDeliveryId.get(delivery.id);

        if (!input) {
          throw new BadRequestException(
            `Missing item for delivery ${delivery.id}`,
          );
        }

        const target = existingByDeliveryId.get(delivery.id);

        if (!target) {
          throw new BadRequestException(
            `Missing placeholder order item for delivery ${delivery.id}`,
          );
        }

        // Validate cost exists
        const dcEntry = acceptedQuote.deliveryCost.find(
          (dc) => dc.delivery.id === delivery.id,
        );

        if (!dcEntry) {
          throw new BadRequestException(
            `No cost found for delivery ${delivery.id}`,
          );
        }

        // Assign values correctly
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

      const now = new Date();

      const deadline = new Date(
        now.getTime() + request.estimatedCompletionHours * 60 * 60 * 1000,
      );

      // Update order
      order.startedAt = now;
      order.deliveryDeadline = deadline;
      order.remainingExtensionHours = 0;
      order.deliveryDetailsProvided = true;
      order.status = OrderStatus.ACTIVE;
      await orderRepo.save(order);

      // Clear cache for vendor and agent dashboards
      if (orderWithRelations?.vendor?.id) {
        await this.dashboardCacheProvider.invalidateBoth(
          orderWithRelations.vendor.id,
          request.quotes[0].agent.id,
        );

        // Clear orders cache for vendor
        await this.ordersCacheProvider.invalidateVendor(
          orderWithRelations.vendor.id,
        );
      }

      // Clear orders cache for agent
      await this.ordersCacheProvider.invalidateAgent(
        request.quotes[0].agent.id,
      );

      // Notify agent of new order assignment
      await this.notifyAgent({
        agentEmail: assignedAgent.user.email,
        orderReference: order.reference,
      });

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
    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);
      const agentRepo = manager.getRepository(Agent);

      // 1) Lock OrderItem row
      const lockedOI = await oiRepo.findOne({
        where: { id: orderItem.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedOI) throw new Error('Order item not found');

      // 2) Load full graph
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

      // Prevent double increment
      if (oi.status === OrderStatus.DELIVERED) {
        return;
      }

      // 3) Update status
      oi.status = OrderStatus.DELIVERED;
      await oiRepo.save(oi);

      // 4) Increment + Recalculate Trust Score
      if (oi.agent?.id) {
        // Increment deliveries (atomic)
        await agentRepo.increment({ id: oi.agent.id }, 'total_deliveries', 1);

        // Fetch updated agent (IMPORTANT)
        const updatedAgent = await agentRepo.findOne({
          where: { id: oi.agent.id },
        });

        if (!updatedAgent) throw new Error('Agent not found');

        // Calculate trust score
        const trustScore = calculateTrustScore(updatedAgent);

        // Persist trust score
        await agentRepo.update(
          { id: updatedAgent.id },
          { trust_score: trustScore },
        );
      }

      // 5) Release escrow
      await this.escrowService.releaseToAgent(oi.id, manager);

      // 6) Auto-complete order
      await this.autoCompleteOrder(oi.order.id, manager);
    });

    // Delete cache for agent dashboards
    await this.dashboardCacheProvider.invalidateAgent(orderItem.agent?.id);

    // Delete cache for orderitems
    await this.ordersCacheProvider.invalidateOrderItems(orderItem.id);

    // Notify vendor
    await this.notifyVendorDelivered({
      vendorEmail: orderItem.order.vendor.user.email,
      orderReference: orderItem.order.reference,
      vendorName:
        orderItem.order.vendor.businessName ||
        orderItem.order.vendor.user.firstName,
    });

    // Notify agent of payment received
    await this.notifyAgentPaymentReceived({
      agentEmail: orderItem.agent?.user?.email || '',
      agentName: orderItem.agent?.businessName || 'Agent',
      reference: orderItem.order.reference,
      amount: orderItem.cost,
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
      relations: [
        'agent',
        'agent.user',
        'order',
        'order.vendor',
        'order.vendor.user',
      ],
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
      const agentRepo = manager.getRepository(Agent);

      // STEP 1: Lock OrderItem WITHOUT relations (avoids LEFT JOIN + FOR UPDATE)
      const lockedOI = await oiRepo.findOne({
        where: { id: orderItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedOI) throw new Error('Order item not found');

      // STEP 2: Load full graph WITHOUT lock
      const oi = await oiRepo.findOne({
        where: { id: orderItemId },
        relations: [
          'order',
          'order.vendor',
          'order.vendor.user',
          'agent',
          'agent.user',
        ],
      });

      if (!oi) throw new Error('Order item not found');

      // Re-check ownership inside TX (safe)
      if (!oi.agent || oi.agent.id !== agentUser.id) {
        throw new UnauthorizedException(
          'This delivery does not belong to you.',
        );
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

      if (Number(agentWallet.escrowBalance) < codAmount) {
        throw new BadRequestException(
          'Insufficient balance in escrow',
        );
      }

      // (1) COD settlement: agent -> vendor
      const codAmountKobo = this.currencyConvert.toKobo(Number(oi.codAmount));

      // Normalize bigint-safe values
      const agentBalanceKobo = Number(agentWallet.escrowBalance ?? 0);
      const vendorBalanceKobo = Number(vendorWallet.availableBalance ?? 0);

      if (agentBalanceKobo < codAmountKobo) {
        throw new BadRequestException('Insufficient balance in escrow');
      }

      // Safe transfer in KOBO
      agentWallet.escrowBalance = agentBalanceKobo - codAmountKobo;
      vendorWallet.availableBalance = vendorBalanceKobo + codAmountKobo;

      await walletRepo.save([agentWallet, vendorWallet]);

      // Prevent double increment if already delivered
      if (oi.status === OrderStatus.DELIVERED) {
        return;
      }

      // (2) update status to delivered
      oi.status = OrderStatus.DELIVERED;
      await oiRepo.save(oi);

      // Increment agent delivery count (atomic)
      if (oi.agent?.id) {
        // Increment deliveries (atomic)
        await agentRepo.increment({ id: oi.agent.id }, 'total_deliveries', 1);

        // Fetch updated agent (IMPORTANT)
        const updatedAgent = await agentRepo.findOne({
          where: { id: oi.agent.id },
        });

        if (!updatedAgent) throw new Error('Agent not found');

        // Calculate trust score
        const trustScore = calculateTrustScore(updatedAgent);

        // Persist trust score
        await agentRepo.update(
          { id: updatedAgent.id },
          { trust_score: trustScore },
        );
      }

      // (3) Release delivery fee to agent
      await this.escrowService.releaseToAgent(oi.id, manager);

      // (4) Auto-complete order
      await this.autoCompleteOrder(oi.order.id, manager);

      // (5) Log COD transactions
      const agentUserEntity = await userRepo.findOne({
        where: { id: agentUserId },
      });
      const vendorUserEntity = await userRepo.findOne({
        where: { id: vendorUserId },
      });

      // Generate unique reference for both transactions (same ref for both sides of COD)
      const transactionRef = generateTransactionRef();

      if (agentUserEntity) {
        await this.txService.logTransaction(
          {
            user: agentUserEntity,
            type: TransactionType.DEBIT,
            amount: codAmountKobo,
            description: `COD paid to vendor...`,
            reference: transactionRef,
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
            amount: codAmountKobo,
            description: `COD received from agent for an item in order #${oi.order.reference}`,
            orderItem: oi,
            reference: transactionRef,
            status: TransactionStatus.SUCCESSFUL,
          },
          manager,
        );
      }
    });

    // Delete cache for agent dashboards
    await this.dashboardCacheProvider.invalidateAgent(orderItem.agent?.id);

    // Delete cache for orderitems
    await this.ordersCacheProvider.invalidateOrderItems(orderItem.id);

    // Notify vendor of COD payment
    await this.notifyVendorCodPayment({
      vendorEmail: orderItem.order.vendor.user.email,
      orderReference: orderItem.order.reference,
      vendorName:
        orderItem.order.vendor.businessName ||
        orderItem.order.vendor.user.firstName,
      amountPaid: orderItem.codAmount,
      deliveryItem: orderItem.itemName,
    });

    // Notify agent of payment received
    await this.notifyAgentPaymentReceived({
      agentEmail: orderItem.agent?.user?.email || '',
      agentName: orderItem.agent?.businessName || 'Agent',
      reference: orderItem.order.reference,
      amount: orderItem.cost,
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
    if (!agentUser) throw new UnauthorizedException('Agent not found');

    // Find order item (no lock here, relations OK)
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

    if (!orderItem) throw new NotFoundException('Order item not found');

    if (!orderItem.agent || orderItem.agent.id !== agentUser.id) {
      throw new UnauthorizedException('You cannot cancel this order');
    }

    const allowed = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];
    if (!allowed.includes(orderItem.status)) {
      throw new BadRequestException(
        'Only IN_PROGRESS and DECLINED items can be cancelled',
      );
    }

    // Execute cancellation within transaction
    await this.dataSource.transaction(async (manager) => {
      const oiRepo = manager.getRepository(OrderItem);

      // STEP 1: Lock the OrderItem row WITHOUT relations
      const lockedOI = await oiRepo.findOne({
        where: { id: orderItemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOI) throw new NotFoundException('Order item not found');

      // STEP 2: Load graph WITHOUT lock (safe)
      const oi = await oiRepo.findOne({
        where: { id: orderItemId },
        relations: [
          'order',
          'order.vendor',
          'order.vendor.user',
          'agent',
          'agent.user',
        ],
      });
      if (!oi) throw new NotFoundException('Order item not found');

      // Re-check ownership inside TX (safe)
      if (!oi.agent || oi.agent.id !== agentUser.id) {
        throw new UnauthorizedException('You cannot cancel this order');
      }

      // Re-check status inside TX (safe)
      const allowedInTx = [OrderStatus.IN_PROGRESS, OrderStatus.DECLINED];
      if (!allowedInTx.includes(oi.status)) {
        throw new BadRequestException(
          'Only IN_PROGRESS and DECLINED items can be cancelled',
        );
      }

      // Mark order item cancelled
      oi.status = OrderStatus.CANCELLED;
      await oiRepo.save(oi);

      // Refund escrow via EscrowService (uses same manager/tx)
      await this.escrowService.refundToVendor(oi.id, manager);

      // auto-complete order
      await this.autoCompleteOrder(oi.order.id, manager);
    });

    // Notify vendor of item cancelled
    await this.notifyVendorCancelled({
      vendorEmail: orderItem.order.vendor.user.email,
      orderReference: orderItem.order.reference,
      vendorName:
        orderItem.order.vendor.businessName ||
        orderItem.order.vendor.user.firstName,
    });

    return { message: 'Order canceled. Vendor refunded from escrow.' };
  }

  /**
   * Method to automatically mark order as completed
   */
  private async autoCompleteOrder(orderId: number, manager: EntityManager) {
    const orderRepo = manager.getRepository(Order);
    const deliveryRequestRepo = manager.getRepository(DeliveryRequest);

    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: [
        'items',
        'vendor',
        'vendor.user',
        'request',
        'request.quotes',
        'request.quotes.agent',
        'request.quotes.agent.user',
      ],
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

      // Update Delivery Request status
      if (order.request && order.request.status !== RequestStatus.CLOSED) {
        order.request.status = RequestStatus.CLOSED;
        await deliveryRequestRepo.save(order.request);
      }

      // Clear cache for vendor and agent dashboards
      await this.dashboardCacheProvider.invalidateVendor(order.vendor.id);

      // Clear orders cache for vendor
      await this.ordersCacheProvider.invalidateVendor(order.vendor.id);

      // Clear orders cache for agent
      await this.ordersCacheProvider.invalidateAgent(
        order.request.quotes[0].agent.id,
      );

      // Notify vendor of order completion
      await this.notifyVendorCompleted({
        vendorEmail: order.vendor.user.email,
        orderReference: order.reference,
        vendorName: order.vendor.businessName || order.vendor.user.firstName,
      });
    }
  }

  /**
   * Method to get orders assigned to an agent
   */
  async getOrdersAssignedToAgent(userId: number, ordersQuery: GetOrdersDto) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) throw new BadRequestException('Agent not found');

    const page = ordersQuery.page || 1;
    const limit = ordersQuery.limit || 10;
    const status = ordersQuery.status || 'all';

    // Use provider directly
    const cached = await this.ordersCacheProvider.getAgentOrders(
      agent.id,
      page,
      limit,
      status,
    );

    if (cached) return cached;

    // Build query
    const where: any = {
      request: {
        quotes: {
          agent: { id: agent.id },
        },
      },
    };

    if (ordersQuery.status) {
      where.status = ordersQuery.status;
    }

    const orders = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.orderRepo,
      {
        where,
        relations: ['request', 'vendor'],
        order: { createdAt: 'DESC' },
      },
    );

    // Cache via provider
    await this.ordersCacheProvider.setAgentOrders(
      agent.id,
      page,
      limit,
      status,
      orders,
    );

    return orders;
  }

  /**
   * Method to get orders made by a vendor
   */
  async getOrdersForVendor(userId: number, ordersQuery: GetOrdersDto) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) throw new BadRequestException('Vendor not found');

    const page = ordersQuery.page || 1;
    const limit = ordersQuery.limit || 10;
    const status = ordersQuery.status || 'all';

    // Try cache
    const cached = await this.ordersCacheProvider.getVendorOrders(
      vendor.id,
      page,
      limit,
      status,
    );

    if (cached) return cached;

    const where: any = {
      vendor: { id: vendor.id },
    };

    if (ordersQuery.status) {
      where.status = ordersQuery.status;
    }

    const orders = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.orderRepo,
      {
        where,
        relations: [
          'request',
          'vendor',
          'request.quotes',
          'request.quotes.agent',
          'request.quotes.agent.user',
          'request.quotes.deliveryCost',
          'request.quotes.deliveryCost.delivery',
        ],
        order: { createdAt: 'DESC' },
      },
    );

    // Cache
    await this.ordersCacheProvider.setVendorOrders(
      vendor.id,
      page,
      limit,
      status,
      orders,
    );

    return orders;
  }

  /**
   * Method to get order Items for an order
   */
  async getOrderItems(orderId: number) {
    const cached = await this.ordersCacheProvider.getOrderItems(orderId);
    if (cached) return cached;

    const items = await this.orderItemRepo.find({
      where: { order: { id: orderId } },
      relations: ['delivery']
    });

    await this.ordersCacheProvider.setOrderItems(orderId, items);

    return items;
  }

  /**
   * Method to send remider
   */
  async sendDeliveryDetailsReminder(userId: number, orderId: number) {
    let emailPayload: {
      vendorEmail: string;
      orderReference: string;
      vendorName: string;
      orderUrl: string;
    } | null = null;

    await this.dataSource.transaction(async (manager) => {
      const agentRepo = manager.getRepository(Agent);
      const orderRepo = manager.getRepository(Order);

      const agent = await agentRepo.findOne({
        where: { user: { id: userId } },
      });

      if (!agent) throw new BadRequestException('Agent not found');

      const order = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const orderWithRelations = await orderRepo.findOne({
        where: { id: orderId },
        relations: [
          'vendor',
          'vendor.user',
          'items',
          'items.agent',
          'request',
          'request.quotes',
          'request.quotes.agent',
        ],
      });

      if (!orderWithRelations) {
        throw new NotFoundException('Order not found');
      }

      // Ensure agent is assigned
      const isAgentAssigned = orderWithRelations.request.quotes.some(
        (q) =>
          q.agent &&
          q.agent.id === agent.id &&
          q.status === QuoteStatus.ACCEPTED,
      );

      if (!isAgentAssigned) {
        throw new ForbiddenException('You are not assigned to this order');
      }

      // Check delivery details
      if (order.deliveryDetailsProvided) {
        throw new BadRequestException(
          'Vendor has already provided delivery details',
        );
      }

      // Check order status
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          'Reminder can only be sent for pending orders',
        );
      }

      // Enforce 6-hour cooldown
      if (order.lastReminderSentAt) {
        const now = Date.now();
        const lastSent = new Date(order.lastReminderSentAt).getTime();

        const diffInHours = (now - lastSent) / (1000 * 60 * 60);

        if (diffInHours < 6) {
          throw new BadRequestException(
            `You can send another reminder in ${(6 - diffInHours).toFixed(
              1,
            )} hours`,
          );
        }
      }

      // Update timestamp FIRST (inside transaction)
      order.lastReminderSentAt = new Date();
      await orderRepo.save(order);

      // Prepare email payload (DO NOT SEND YET)
      emailPayload = {
        vendorEmail: orderWithRelations.vendor.user.email,
        orderReference: orderWithRelations.reference,
        vendorName:
          orderWithRelations.vendor.businessName ||
          orderWithRelations.vendor.user.firstName,
        orderUrl: `${process.env.FRONTEND_URL}/vendor/orders/${order.id}`,
      };
    });

    // Send email AFTER transaction commits
    if (emailPayload) {
      await this.notifyVendorReminder(emailPayload);
    }

    return {
      message: 'Reminder sent successfully',
    };
  }

  /**
   * Method to request for time extension
   */
  async requestOrderExtension(
    userId: number,
    orderId: number,
    dto: RequestExtensionDto,
  ) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) throw new NotFoundException('Agent not found');

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check for existing pending extension
    const existingPendingRequest = await this.extensionRepo.findOne({
      where: {
        order: { id: order.id },
        agent: { id: agent.id },
        status: ExtensionStatus.PENDING,
      },
    });

    // Block duplicate request
    if (existingPendingRequest) {
      throw new BadRequestException(
        'You already have a pending extension request for this order',
      );
    }

    const extension = this.extensionRepo.create({
      order,
      agent,
      requestedHours: dto.requestedHours,
      reason: dto.reason,
    });

    return await this.extensionRepo.save(extension);
  }

  /**
   * Method to approve time extension request
   */
  async approveExtension(userId: number, extensionId: number) {
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

    const extension = await this.extensionRepo.findOne({
      where: { id: extensionId },
      relations: ['order'],
    });

    if (!extension) {
      throw new NotFoundException('Extension request not found');
    }

    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException('Extension already processed');
    }

    const order = extension.order;

    const newDeadline = new Date(
      order.deliveryDeadline.getTime() +
        extension.requestedHours * 60 * 60 * 1000,
    );

    order.deliveryDeadline = newDeadline;
    order.isExtended = true;
    order.remainingExtensionHours += extension.requestedHours;

    extension.status = ExtensionStatus.APPROVED;

    await this.orderRepo.save(order);
    await this.extensionRepo.save(extension);

    return {
      message: 'Extension approved successfully',
      newDeadline,
    };
  }
}
