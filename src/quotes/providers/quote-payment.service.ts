import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { Vendor } from 'src/vendor/vendor.entity';
import { WalletsService } from 'src/wallets/providers/wallets.service';
import { DataSource, Not, Repository } from 'typeorm';
import { Payment } from 'src/payments/payment.entity';
import { Order } from 'src/orders/entities/order.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { Escrow } from 'src/escrow/escrow.entity';
import { QuoteStatus } from '../enums/quoteStatus.enum';
import { PaymentStatus } from 'src/payments/enums/paymentStatus.enum';
import { Wallet } from 'src/wallets/entities/wallet.entity';
import { OrderStatus } from 'src/orders/enums/orderStatus.enum';
import { EscrowStatus } from 'src/escrow/enums/escrowStatus.enum';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import { PaymentMethod } from 'src/payments/enums/paymentMethod.enum';
import { MailerService } from 'src/mailer/providers/mailer.service';

@Injectable()
export class QuotePaymentService {
  constructor(
    /** Injecting required repositories and services */
    private readonly dataSource: DataSource,
    private readonly walletService: WalletsService,
    private readonly txService: TransactionsService,
    private readonly reference: ReferenceProvider,

    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    @InjectRepository(DeliveryRequest)
    private readonly requestRepo: Repository<DeliveryRequest>,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,
  ) {}

  private async notifyAgent(payload: {
    agentEmail: string;
    agentName: string;
    vendorName: string;
    deliveryTitle: string;
    orderId: number;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.agentEmail,
        'New Delivery Order 🎉',
        'agent-new-order',
        {
          agentName: payload.agentName,
          vendorName: payload.vendorName,
          deliveryTitle: payload.deliveryTitle,
          orderUrl: `${process.env.FRONTEND_URL}/agent/orders/${payload.orderId}`,
        },
      );
    } catch (error) {
      console.error('Failed to send agent email:', error);
    }
  }

  async payAcceptedQuoteWithWallet(vendorUserId: number, requestId: number) {
    // Fetch vendor by user ID
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: vendorUserId } },
      relations: ['user'],
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    // Fetch delivery request with related quotes and deliveries
    const request = await this.requestRepo.findOne({
      where: { id: requestId, vendor: { id: vendor.id } },
      relations: [
        'vendor',
        'vendor.user',
        'deliveries',
        'quotes',
        'quotes.agent',
        'quotes.agent.user',
        'quotes.deliveryCost',
        'quotes.deliveryCost.delivery',
      ],
    });
    if (!request) throw new BadRequestException('Request not found');

    // Find the accepted quote
    const acceptedQuote = request.quotes.find(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );
    if (!acceptedQuote)
      throw new BadRequestException('No accepted quote found');

    const total = Number(acceptedQuote.subtotal);
    if (!total || total <= 0)
      throw new BadRequestException('Invalid quote total');

    // Ensure vendor has a wallet
    await this.walletService.getOrCreateWallet(vendor.user.id);

    // Payment reference
    const paymentRef = `QUOTE-${request.id}`;

    // Use this variable so we can email after transaction succeeds
    let createdOrder: Order | undefined;

    // Start transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);
      const escrowRepo = manager.getRepository(Escrow);

      // Lock vendor wallet
      const vendorWallet = await this.walletService.lockWallet(
        vendor.user.id,
        manager,
      );

      if (Number(vendorWallet.availableBalance) < total) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Move total: vendor available -> vendor escrow
      vendorWallet.availableBalance = (
        Number(vendorWallet.availableBalance) - total
      ).toFixed(2);

      vendorWallet.escrowBalance = (
        Number(vendorWallet.escrowBalance) + total
      ).toFixed(2);

      await walletRepo.save(vendorWallet);

      // Create order
      const order = await orderRepo.save(
        orderRepo.create({
          reference: this.reference.generateOrderRef(),
          vendor: { id: vendor.id },
          request: { id: request.id },
          totalAmount: total,
          status: OrderStatus.PENDING, // waiting vendor to supply item info
        }),
      );

      createdOrder = order;

      // =========================
      // Create order items using your CURRENT structure:
      // Loop request.deliveries and map each to acceptedQuote.deliveryCost
      // =========================
      const itemsToSave: OrderItem[] = [];

      for (let i = 0; i < request.deliveries.length; i++) {
        const delivery = request.deliveries[i];

        const dcEntry = acceptedQuote.deliveryCost.find(
          (dc) => dc.delivery.id === delivery.id,
        );

        if (!dcEntry) {
          throw new BadRequestException(
            `No cost found for delivery ${delivery.id}`,
          );
        }

        // Placeholder values (vendor will update later)
        const orderItem = orderItemRepo.create({
          order: { id: order.id },
          delivery: { id: delivery.id },
          agent: { id: acceptedQuote.agent.id },

          itemName: '', // placeholder
          quantity: 0, // placeholder
          buyerName: '', // placeholder
          buyerPhone: '', // placeholder

          deliveryType: delivery.deliveryType,
          cost: dcEntry.cost, // keep as decimal from db
          codAmount: 0, // vendor will set later for COD
          status: OrderStatus.PENDING,
        });

        itemsToSave.push(orderItem);
      }

      const createdItems = await orderItemRepo.save(itemsToSave);

      // Create escrow per item (split escrow)
      for (const oi of createdItems) {
        const escrowRef = `ESCROW-OI-${oi.id}`;

        await escrowRepo.save(
          escrowRepo.create({
            reference: escrowRef,
            order: { id: order.id },
            orderItem: { id: oi.id },
            vendor: { id: vendor.id },
            agent: { id: acceptedQuote.agent.id },
            amount: Number(oi.cost).toFixed(2),
            status: EscrowStatus.HELD,
          }),
        );
      }

      // Ledger log: vendor paid (debit available)
      await this.txService.logTransaction(
        {
          user: vendor.user,
          type: TransactionType.DEBIT,
          amount: total,
          description: `Paid ₦${total} for request #${request.id}. Funds held in escrow across ${createdItems.length} items.`,
          reference: paymentRef,
          status: TransactionStatus.SUCCESSFUL,
          order,
        },
        manager,
      );

      return {
        message: 'Payment confirmed. Order created.',
        orderRef: order.reference,
      };
    });

    // Notify agent AFTER transaction succeeds (do not do this inside tx)
    if (createdOrder) {
      await this.notifyAgent({
        agentEmail: acceptedQuote.agent.user.email,
        agentName:
          acceptedQuote.agent.businessName ??
          acceptedQuote.agent.user.firstName ??
          'Agent',
        vendorName: vendor.businessName ?? vendor.user.firstName ?? 'Vendor',
        deliveryTitle: request.title,
        orderId: createdOrder?.id,
      });
    }

    return result;
  }
}
