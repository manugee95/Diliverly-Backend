import axios from 'axios';
import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitiatePaymentDto } from '../dtos/initiatePayment.dto';
import { HttpService } from '@nestjs/axios';
import { User } from 'src/users/user.entity';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private headers = {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
    'Content-Type': 'application/json',
  };

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
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

  async createCustomer(user: User) {
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/customer`,
        {
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        { headers: this.headers },
      ),
    );

    return data.data;
  }

  async createDedicatedAccount(customerCode: string) {
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/dedicated_account`,
        {
          customer: customerCode,
          preferred_bank: 'wema-bank', // or providus
        },
        { headers: this.headers },
      ),
    );

    return data.data;
  }
}
