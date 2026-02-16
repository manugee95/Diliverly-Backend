import axios from 'axios';
import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitiatePaymentDto } from '../dtos/initiatePayment.dto';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly config: ConfigService) {}

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

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
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
}
