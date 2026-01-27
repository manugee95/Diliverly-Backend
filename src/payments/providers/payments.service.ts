import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { QuoteStatus } from 'src/quotes/enums/quoteStatus.enum';
import { Vendor } from 'src/vendor/vendor.entity';
import { Not, Repository } from 'typeorm';
import axios from 'axios';
import { Payment } from '../payment.entity';
import { PaymentStatus } from '../enums/paymentStatus.enum';
import { ConfigService } from '@nestjs/config';
import { RequestStatus } from 'src/delivery-requests/enums/requestStatus.enum';
import { DataSource } from 'typeorm';
import { Order } from 'src/orders/entities/order.entity';
import { PaymentMethod } from '../enums/paymentMethod.enum';
import { User } from 'src/users/user.entity';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import { MailerService } from 'src/mailer/providers/mailer.service';

@Injectable()
export class PaymentsService {
  constructor(
    /**
     * Inject delivery request repository
     */
    @InjectRepository(DeliveryRequest)
    private readonly deliveryRequestRepo: Repository<DeliveryRequest>,

    /**
     * Inject Vendor repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    /**
     * Inject User repository
     */
    private readonly reference: ReferenceProvider,

    /**
     * Inject Payment repository
     */
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    /**
     * Inject Config Service
     */
    private readonly config: ConfigService,

    /**
     * Inject Transaction Service
     */
    private readonly transactionService: TransactionsService,

    /**
     * Inject Data Source
     */
    private readonly dataSource: DataSource,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,
  ) {}

  /**
   * Method to initiate payment via Paystack
   */
  async initiatePayment(userId: number, requestId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId, vendor: { id: vendor.id } },
      relations: [
        'quotes',
        'quotes.agent',
        'quotes.agent.user',
        'vendor',
        'vendor.user',
      ],
    });
    if (!request) throw new BadRequestException('Request not found');

    const acceptedQuote = request.quotes.find(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );
    if (!acceptedQuote)
      throw new BadRequestException('You must accept a quote first');

    const totalAmount = acceptedQuote.subtotal;
    const walletBalance = vendor.user.walletBalance;

    const existingPayment = await this.paymentRepo.findOne({
      where: {
        deliveryRequest: { id: request.id },
        status: Not(PaymentStatus.FAILED),
      },
    });
    if (existingPayment)
      throw new BadRequestException('Payment already initiated');

    // =========================
    // CASE 1: FULL WALLET
    // =========================
    if (walletBalance >= totalAmount) {
      const result = await this.handleWalletPayment(
        vendor,
        request,
        acceptedQuote,
        totalAmount,
      );

      await this.notifyAgent({
        agentEmail: result.agent.user.email,
        agentName: result.agent.businessName ?? result.agent.user.firstName,
        vendorName: vendor.businessName ?? vendor.user.firstName,
        deliveryTitle: request.title,
        orderId: result.order.id,
      });

      return {
        message: 'Payment successful',
        orderRef: result.order.reference,
      };
    }

    // =========================
    // CASE 2: PARTIAL WALLET
    // =========================
    if (walletBalance > 0) {
      return this.handleHybridPayment(
        vendor,
        request,
        acceptedQuote,
        totalAmount,
        walletBalance,
      );
    }

    // =========================
    // CASE 3: PAYSTACK ONLY
    // =========================
    return this.handlePaystackPayment(
      vendor,
      request,
      acceptedQuote,
      totalAmount,
    );
  }

  private async handleWalletPayment(
    vendor,
    request,
    quote,
    totalAmount: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const orderRepo = manager.getRepository(Order);
      const paymentRepo = manager.getRepository(Payment);
      const requestRepo = manager.getRepository(DeliveryRequest);

      const user = await userRepo.findOne({
        where: { id: vendor.user.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) throw new BadRequestException('User not found');

      user.walletBalance -= totalAmount;
      await userRepo.save(user);

      await paymentRepo.save({
        deliveryRequest: request,
        vendor,
        amount: totalAmount,
        reference: `WALLET-${Date.now()}`,
        status: PaymentStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        walletDeduction: totalAmount,
      });

      await requestRepo.update(request.id, {
        status: RequestStatus.ASSIGNED,
      });

      const order = await orderRepo.save({
        vendor,
        request,
        reference: this.reference.generateOrderRef(),
        totalAmount,
      });

      await this.transactionService.logTransaction(
        {
          user,
          type: TransactionType.DEBIT,
          amount: totalAmount,
          description: `Payment for Order #${order.reference}`,
          reference: this.reference.generateTransactionRef(),
          status: TransactionStatus.SUCCESSFUL,
        },
        manager,
      );

      return { order, agent: quote.agent };
    });
  }

  private async handleHybridPayment(
    vendor,
    request,
    quote,
    totalAmount: number,
    walletBalance: number,
  ) {
    const walletDeduction = walletBalance;
    const paystackAmount = (totalAmount - walletDeduction) * 100;

    vendor.user.walletBalance = 0;
    await this.userRepo.save(vendor.user);

    return this.initPaystack(
      vendor,
      request,
      quote,
      totalAmount,
      walletDeduction,
      PaymentMethod.HYBRID,
      paystackAmount,
    );
  }

  private async handlePaystackPayment(
    vendor,
    request,
    quote,
    totalAmount: number,
  ) {
    return this.initPaystack(
      vendor,
      request,
      quote,
      totalAmount,
      0,
      PaymentMethod.PAYSTACK,
      totalAmount * 100,
    );
  }

  private async initPaystack(
    vendor,
    request,
    quote,
    totalAmount,
    walletDeduction,
    method,
    amountInKobo,
  ) {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: vendor.user.email,
        amount: amountInKobo,
        metadata: {
          requestId: request.id,
          quoteId: quote.id,
          vendorId: vendor.id,
          walletDeduction,
        },
        callback_url: `${this.config.get('APP_URL')}/api/payments/paystack/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
        },
      },
    );

    await this.paymentRepo.save({
      deliveryRequest: request,
      vendor,
      amount: totalAmount,
      reference: response.data.data.reference,
      status: PaymentStatus.INITIATED,
      walletDeduction,
      paymentMethod: method,
    });

    return {
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference,
      walletUsed: walletDeduction,
      paystackToCharge: amountInKobo / 100,
    };
  }

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

  async verifyPayment(reference: string) {
    await this.verifyPaystack(reference);

    const result = await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const requestRepo = manager.getRepository(DeliveryRequest);
      const orderRepo = manager.getRepository(Order);

      const payment = await paymentRepo.findOne({
        where: { reference },
        relations: [
          'deliveryRequest',
          'deliveryRequest.quotes',
          'deliveryRequest.quotes.agent',
          'deliveryRequest.quotes.agent.user',
          'vendor',
          'vendor.user',
        ],
      });

      if (!payment) throw new BadRequestException('Payment not found');
      if (payment.status === PaymentStatus.SUCCESS)
        return { payment, order: null, quote: null };

      const acceptedQuote = payment.deliveryRequest.quotes.find(
        (q) => q.status === QuoteStatus.ACCEPTED,
      );
      if (!acceptedQuote)
        throw new BadRequestException('No accepted quote found');

      await paymentRepo.update(payment.id, {
        status: PaymentStatus.SUCCESS,
      });

      await requestRepo.update(payment.deliveryRequest.id, {
        status: RequestStatus.ASSIGNED,
      });

      const order = await orderRepo.save({
        vendor: payment.vendor,
        request: payment.deliveryRequest,
        reference: this.reference.generateOrderRef(),
        totalAmount: payment.amount,
      });

      return { payment, order, quote: acceptedQuote };
    });

    if (result.order && result.quote) {
      this.notifyAgent({
        agentEmail: result.quote.agent.user.email,
        agentName:
          result.quote.agent.businessName ?? result.quote.agent.user.firstName,
        vendorName:
          result.payment.vendor.businessName ??
          result.payment.vendor.user.firstName,
        deliveryTitle: result.payment.deliveryRequest.title,
        orderId: result.order.id,
      });
    }

    return {
      success: true,
      orderRef: result.order?.reference,
    };
  }

  private async verifyPaystack(reference: string) {
    const res = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
        },
      },
    );

    if (res.data.data.status !== 'success') {
      throw new BadRequestException('Payment failed');
    }
  }
}
