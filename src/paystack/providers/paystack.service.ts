import axios from 'axios';
import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitiatePaymentDto } from '../dtos/initiatePayment.dto';
import { User } from '../../users/user.entity';
import { Transaction } from '../../transactions/transaction.entity';
import { Repository } from 'typeorm';
import { TransactionStatus } from '../../transactions/enums/transactionStatus.enum';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private headers = {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  private get secretKey() {
    return this.config.get<string>('PAYSTACK_SECRET_KEY');
  }

  async initializeTransaction(dto: InitiatePaymentDto): Promise<{
    authorizationUrl: string;
    reference: string;
  }> {
    const { email, amountNaira, reference, callback_url, metadata } = dto;

    const amountKobo = Math.round(amountNaira * 100);

    const res = await axios.post(
      `${this.baseUrl}/transaction/initialize`,
      {
        email: email,
        amount: amountKobo,
        reference: reference,
        callback_url: callback_url,
        metadata: metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = res.data?.data;
    return {
      authorizationUrl: data.authorization_url,
      reference: data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<any> {
    const res = await axios.get(
      `${this.baseUrl}/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );
    return res.data;
  }

  async verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    if (!signature)
      throw new UnauthorizedException('Missing Paystack signature');

    if (!this.secretKey)
      throw new UnauthorizedException('Paystack secret key is not configured');

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature)
      throw new UnauthorizedException('Invalid Paystack signature');
  }

  async handleTransferApproval(event: any): Promise<boolean> {
    try {

      // Extract relevant details from the event
      const payload = event?.data?.details?.body;
      const transfer = event?.data?.transfers?.[0];

      if (!payload || !transfer) {
        console.log('Invalid payload structure');
        return false;
      }

      const amount = Number(payload.amount);
      const reference = payload.reference;

      if (!amount || !reference) {
        console.log('Missing amount or reference');
        return false;
      }

      // -------------------------------
      // 1. Check if transaction exists
      // -------------------------------
      const tx = await this.transactionRepo.findOne({
        where: { reference },
      });

      if (!tx) {
        console.log('Transaction not found');
        return false;
      }

      // -------------------------------
      // 2. Prevent double processing
      // -------------------------------
      if (tx.status !== TransactionStatus.PENDING) {
        console.log('Transaction is not pending');
        return false;
      }

      // -------------------------------
      // 3. Validate amount
      // -------------------------------
      if (Number(tx.amount) !== amount) {
        console.log('Amount mismatch');
        return false;
      }

      // -------------------------------
      // 4. Validate recipient (optional but recommended)
      // -------------------------------
      // if (tx.recipientCode && tx.recipientCode !== recipient) {
      //   return false;
      // }

      return true;
    } catch (error) {
      console.error('Approval error:', error);
      return false;
    }
  }

  async createCustomer(user: User) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/customer`,
        {
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        {
          headers: this.headers,
        },
      );

      return response.data.data;
    } catch (error) {
      throw new Error(
        (error as any).response?.data?.message ||
          'Failed to create Paystack customer',
      );
    }
  }

  async createDedicatedAccount(customerCode: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/dedicated_account`,
        {
          customer: customerCode,
          preferred_bank: 'wema-bank',
        },
        {
          headers: this.headers,
        },
      );

      return response.data.data;
    } catch (error) {
      throw new Error(
        (error as any).response?.data?.message ||
          'Failed to create dedicated account',
      );
    }
  }
}
