import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { Vendor } from 'src/vendor/vendor.entity';
import { WalletsService } from 'src/wallets/providers/wallets.service';
import { DataSource, Not, Repository } from 'typeorm';
import { Order } from 'src/orders/entities/order.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { Escrow } from 'src/escrow/escrow.entity';
import { QuoteStatus } from '../enums/quoteStatus.enum';
import { Wallet } from 'src/wallets/entities/wallet.entity';
import { OrderStatus } from 'src/orders/enums/orderStatus.enum';
import { EscrowStatus } from 'src/escrow/enums/escrowStatus.enum';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import { MailerService } from 'src/mailer/providers/mailer.service';
import { Quote } from '../entities/quote.entity';
import { RequestStatus } from 'src/delivery-requests/enums/requestStatus.enum';
import { Agent } from 'src/agent/agent.entity';
import { Delivery } from 'src/delivery-requests/entities/delivery.entity';
import { DeliveryCost } from '../entities/deliveryCost.entity';
import { CurrencyConvertProvider } from 'src/common/providers/currency-convert.provider';

@Injectable()
export class QuotePaymentService {
  constructor(
    /** Injecting required repositories and services */
    private readonly dataSource: DataSource,
    private readonly walletService: WalletsService,
    private readonly txService: TransactionsService,
    private readonly reference: ReferenceProvider,
    private readonly currencyConvert: CurrencyConvertProvider,

    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

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

  private async processPayment(input: {
    vendor: Vendor;
    requestId: number;
    quoteId: number;
  }) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const requestRepo = manager.getRepository(DeliveryRequest);
      const quoteRepo = manager.getRepository(Quote);
      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);
      const escrowRepo = manager.getRepository(Escrow);

      // 1. Lock request
      const request = await requestRepo.findOne({
        where: { id: input.requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) throw new BadRequestException('Request not found');

      if (request.status === RequestStatus.ASSIGNED) {
        throw new BadRequestException('Already paid');
      }

      // 2. Find quote
      const quote = await quoteRepo.findOne({
        where: { id: input.quoteId, status: QuoteStatus.ACCEPTED },
        relations: ['agent', 'agent.user'],
      });

      if (!quote) throw new BadRequestException('Invalid quote');

      const total = Number(quote.subtotal);

      // 3. Lock wallet
      const wallet = await walletRepo.findOne({
        where: { user: { id: input.vendor.user.id } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new BadRequestException('Wallet not funded yet');

      if (Number(wallet.availableBalance) < total) {
        throw new BadRequestException('Insufficient balance');
      }

      // 4. Move funds
      const totalKobo = this.currencyConvert.toKobo(Number(quote.subtotal));

      if (wallet.availableBalance < totalKobo) {
        throw new BadRequestException('Insufficient balance');
      }

      wallet.availableBalance -= totalKobo;
      wallet.escrowBalance += totalKobo;

      await walletRepo.save(wallet);

      // 5. Idempotency check
      const existingOrder = await orderRepo.findOne({
        where: { request: { id: request.id } },
      });

      if (existingOrder) {
        return {
          orderId: existingOrder.id,
          deliveryTitle: request.title,
        };
      }

      // 6. Create order
      const order = await orderRepo.save(
        orderRepo.create({
          reference: this.reference.generateOrderRef(),
          vendor: { id: input.vendor.id },
          request: { id: request.id },
          totalAmount: total,
          status: OrderStatus.PENDING,
        }),
      );

      // 7. Load deliveries (NO LOCK)
      const deliveries = await manager.getRepository(Delivery).find({
        where: { request: { id: request.id } },
      });

      // 8. Load delivery costs
      const costs = await manager.getRepository(DeliveryCost).find({
        where: { quote: { id: quote.id } },
        relations: ['delivery'],
      });

      // 9. Create order items
      const items = deliveries.map((delivery) => {
        const dc = costs.find((c) => c.delivery.id === delivery.id);

        if (!dc) {
          throw new BadRequestException(
            `Missing cost for delivery ${delivery.id}`,
          );
        }

        return orderItemRepo.create({
          order: { id: order.id },
          delivery: { id: delivery.id },
          agent: { id: quote.agent.id },
          itemName: '', // placeholder
          quantity: 0, // placeholder
          buyerName: '', // placeholder
          buyerPhone: '', // placeholder
          deliveryType: delivery.deliveryType,
          codAmount: 0, // vendor will set later for COD
          cost: dc.cost,
          status: OrderStatus.PENDING,
        });
      });

      const savedItems = await orderItemRepo.save(items);

      // 10. Create escrow
      await escrowRepo.save(
        savedItems.map((item) =>
          escrowRepo.create({
            reference: `ESCROW-OI-${item.id}`,
            order: { id: order.id },
            orderItem: { id: item.id },
            vendor: { id: input.vendor.id },
            agent: { id: quote.agent.id },
            amount: this.currencyConvert.toKobo(Number(item.cost)),
            status: EscrowStatus.HELD,
          }),
        ),
      );

      // 11. Mark request completed
      request.status = RequestStatus.ASSIGNED;
      await requestRepo.save(request);

      return {
        orderId: order.id,
        deliveryTitle: request.title,
      };
    });
  }

  async payAcceptedQuoteWithWallet(vendorUserId: number, requestId: number) {
    // 1. Validate vendor
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: vendorUserId } },
      relations: ['user'],
    });

    if (!vendor) throw new BadRequestException('Vendor not found');

    // 2. Fetch accepted quote (NO LOCK)
    const acceptedQuote = await this.quoteRepo.findOne({
      where: {
        request: { id: requestId },
        status: QuoteStatus.ACCEPTED,
      },
      relations: ['agent', 'agent.user'],
    });

    if (!acceptedQuote) {
      throw new BadRequestException('No accepted quote found');
    }

    // 3. Execute atomic transaction
    const result = await this.processPayment({
      vendor,
      requestId,
      quoteId: acceptedQuote.id,
    });

    // 4. Side effects (AFTER COMMIT)
    await this.notifyAgent({
      agentEmail: acceptedQuote.agent.user.email,
      agentName: acceptedQuote.agent.businessName || 'Agent',
      vendorName: vendor.businessName || 'Vendor',
      deliveryTitle: result.deliveryTitle,
      orderId: result.orderId,
    });

    return result;
  }
}
