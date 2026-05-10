import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class SmileIdService {
  private partnerId = process.env.SMILE_PARTNER_ID!;
  private apiKey = process.env.SMILE_API_KEY!;
  private baseUrl = process.env.SMILE_BASE_URL!;

  private generateSignature(timestamp: string) {
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(timestamp)
      .digest('hex');
  }

  async verifyKyc(payload: {
    country: string;
    id_type: string;
    id_number: string;
    callback_url: string;
    partner_params: {
      job_id: string;
      user_id: string;
    };
  }) {
    const timestamp = new Date().toISOString();

    const signature = this.generateSignature(timestamp);

    const response = await axios.post(
      `${this.baseUrl}/v1/async_id_verification`,
      payload,
      {
        headers: {
          partner_id: this.partnerId,
          timestamp,
          signature,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  }
}
