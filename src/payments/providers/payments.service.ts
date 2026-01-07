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
  ) {}

  /**
   * Method to initiate payment via Paystack
   */
  async initiatePayment(userId: number, requestId: number) {
    // 1. Get vendor by userId
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!vendor) throw new BadRequestException('Vendor not found');

    // 2. Get delivery request
    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId, vendor: { id: vendor.id } },
      relations: ['quotes', 'vendor', 'vendor.user'],
    });

    if (!request) throw new BadRequestException('Request not found');

    // 3. Check accepted quote
    const acceptedQuote = request.quotes.find(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );
    if (!acceptedQuote)
      throw new BadRequestException('You must accept a quote first');

    const totalAmount = acceptedQuote.subtotal;

    // 4. Prevent duplicate payments for same request
    const existingPayment = await this.paymentRepo.findOne({
      where: {
        deliveryRequest: { id: request.id },
        status: Not(PaymentStatus.FAILED),
      },
    });

    if (existingPayment) {
      throw new BadRequestException(
        `Payment has already been initiated or completed for this request`,
      );
    }

    const initialWalletBalance = vendor.user.walletBalance;

    // ==============================================
    // CASE 1 — FULL WALLET PAYMENT
    // ==============================================
    if (initialWalletBalance >= totalAmount) {
      return await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const paymentRepo = manager.getRepository(Payment);
        const requestRepo = manager.getRepository(DeliveryRequest);
        const orderRepo = manager.getRepository(Order);

        // Reload vendor user inside transaction
        const freshUser = await userRepo.findOne({
          where: { id: vendor.user.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!freshUser) throw new BadRequestException('Vendor user not found');

        // Deduct wallet
        freshUser.walletBalance -= totalAmount;
        await userRepo.save(freshUser);

        // Save payment
        await paymentRepo.save({
          deliveryRequest: { id: request.id },
          vendor: { id: vendor.id },
          amount: totalAmount,
          reference: `WALLET-${Date.now()}`,
          status: PaymentStatus.SUCCESS,
          paymentMethod: PaymentMethod.WALLET,
          walletDeduction: totalAmount,
        });

        // Assign request
        await requestRepo.update(
          { id: request.id },
          { status: RequestStatus.ASSIGNED },
        );

        // Create order
        const order = await orderRepo.save({
          vendor: { id: vendor.id },
          request: { id: request.id },
          reference: this.reference.generateOrderRef(),
          totalAmount,
        });

        // Create Transaction record for wallet debit
        await this.transactionService.logTransaction(
          {
            user: freshUser,
            type: TransactionType.DEBIT,
            amount: totalAmount,
            description: `Payment for delivery request with Order #${order.reference}`,
            reference: this.reference.generateTransactionRef(),
            status: TransactionStatus.SUCCESSFUL,
          },
          manager,
        );

        return {
          success: true,
          orderRef: order.reference,
        };
      });
    }

    // ==============================================
    // CASE 2 — PARTIAL WALLET + PAYSTACK
    // ==============================================
    if (initialWalletBalance > 0) {
      return await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const paymentRepo = manager.getRepository(Payment);

        // Reload with lock
        const freshUser = await userRepo.findOne({
          where: { id: vendor.user.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!freshUser) throw new BadRequestException('Vendor user not found');

        const walletDeduction = freshUser.walletBalance;
        freshUser.walletBalance = 0;

        await userRepo.save(freshUser);

        const paystackAmount = (totalAmount - walletDeduction) * 100;

        // Initialize Paystack AFTER wallet is deducted
        const response = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          {
            email: vendor.user.email,
            amount: paystackAmount,
            metadata: {
              requestId,
              quoteId: acceptedQuote.id,
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

        // Save transaction as INITIATED
        await paymentRepo.save({
          deliveryRequest: { id: request.id },
          vendor: { id: vendor.id },
          amount: totalAmount,
          reference: response.data.data.reference,
          status: PaymentStatus.INITIATED,
          walletDeduction,
          paymentMethod: PaymentMethod.HYBRID,
        });

        return {
          message: 'Redirect vendor to complete Paystack payment',
          walletUsed: walletDeduction,
          paystackToCharge: paystackAmount / 100,
          authorizationUrl: response.data.data.authorization_url,
          reference: response.data.data.reference,
        };
      });
    }

    // ==============================================
    // CASE 3 — ZERO WALLET → FULL PAYSTACK
    // ==============================================
    const paystackAmount = totalAmount * 100;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: vendor.user.email,
        amount: paystackAmount,
        metadata: {
          requestId,
          quoteId: acceptedQuote.id,
          vendorId: vendor.id,
          walletDeduction: 0,
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
      deliveryRequest: { id: request.id },
      vendor: { id: vendor.id },
      amount: totalAmount,
      reference: response.data.data.reference,
      status: PaymentStatus.INITIATED,
      walletDeduction: 0,
      paymentMethod: PaymentMethod.PAYSTACK,
    });

    return {
      message: 'Redirect vendor to complete Paystack payment',
      paystackToCharge: totalAmount,
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference,
    };
  }

  async verifyPayment(reference: string) {
    // Verify with Paystack first
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

    // Run DB changes in a transaction
    return await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const requestRepo = manager.getRepository(DeliveryRequest);
      const orderRepo = manager.getRepository(Order);

      // reload payment inside transaction (with deliveryRequest)
      const payment = await paymentRepo.findOne({
        where: { reference },
        relations: ['deliveryRequest', 'vendor'],
      });
      if (!payment) throw new BadRequestException('Payment not found');

      // Prevent double-processing
      if (payment.status === PaymentStatus.SUCCESS) {
        return { success: true, message: 'Payment already processed' };
      }

      // Update payment status to SUCCESS
      await paymentRepo.update(
        { id: payment.id },
        { status: PaymentStatus.SUCCESS },
      );

      // Update request status to ASSIGNED
      await requestRepo.update(
        { id: payment.deliveryRequest.id },
        { status: RequestStatus.ASSIGNED },
      );

      // Create order
      const order = orderRepo.create({
        vendor: { id: payment.vendor.id },
        request: { id: payment.deliveryRequest.id },
        reference: this.reference.generateOrderRef(),
        totalAmount: payment.amount,
      });

      const savedOrder = await orderRepo.save(order);

      // Create Transaction record for wallet debit
      await this.transactionService.logTransaction({
        user: payment.vendor.user,
        type: TransactionType.DEBIT,
        amount: payment.amount,
        description: `Payment for delivery request with Order #${savedOrder.reference}`,
        reference: this.reference.generateTransactionRef(),
        status: TransactionStatus.SUCCESSFUL,
      });

      // Return stored info (could include order id/reference)
      return { success: true, orderRef: savedOrder.reference };
    });
  }
}
