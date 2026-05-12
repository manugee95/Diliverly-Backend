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
      .update(timestamp, 'utf-8')
      .update(this.partnerId, 'utf-8')
      .update('sid_request', 'utf-8')
      .digest()
      .toString('base64');
  }

  async verifyKyc(payload: {
    country: string;
    first_name: string;
    last_name: string;
    id_type: string;
    id_number: string;
    callback_url: string;
    partner_params: {
      job_id: string;
      user_id: string;
      sandbox_result: number;
    };
  }) {
    const timestamp = new Date().toISOString();

    const signature = this.generateSignature(timestamp);

    // 1. Merge authentication and SDK info into the request body
    const fullPayload = {
      ...payload,
      partner_id: this.partnerId,
      timestamp: timestamp,
      signature: signature,
      source_sdk: 'rest_api',
      source_sdk_version: '1.0.0',
    };

    // 2. Send request to Smile API
    const response = await axios.post(
      `${this.baseUrl}/v1/async_id_verification`,
      fullPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // 3. Return response data
    return response.data;
  }

  async verifyKyb(payload: {
    country: string;
    business_type: string;
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

    // 1. Merge authentication and SDK info into the request body
    const fullPayload = {
      ...payload,
      partner_id: this.partnerId,
      timestamp: timestamp,
      signature: signature,
      source_sdk: 'rest_api',
      source_sdk_version: '1.0.0',
    };

    // 2. Send request to Smile API
    const response = await axios.post(
      `${this.baseUrl}/v1/async_business_verification`,
      fullPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // 3. Return response data
    return response.data;
  }

  async verifyPoa(payload: {
    country: string;
    callback_url: string;
    address: string;
    utility_number: string;
    utility_provider: string;
    utility_type: string;
    partner_params: {
      job_id: string;
      user_id: string;
    };
  }) {
    const timestamp = new Date().toISOString();

    const signature = this.generateSignature(timestamp);

    // 1. Merge authentication and SDK info into the request body
    // const fullPayload = {
    //   ...payload,
    //   partner_id: this.partnerId,
    //   timestamp: timestamp,
    //   signature: signature,
    //   source_sdk: 'rest_api',
    //   source_sdk_version: '1.0.0',
    // };

    // 2. Send request to Smile API
    const response = await axios.post(
      `${this.baseUrl}/v2/async-verify-address`,
      payload,
      {
        headers: {
          'smileid-partner-id': this.partnerId,
          'smileid-request-signature': signature,
          'smileid-timestamp': timestamp,
          'smileid-source-sdk': 'rest_api',
          'smileid-source-sdk-version': '0.0.1',
          'Content-Type': 'application/json',
        },
      },
    );

    // 3. Return response data
    return response.data;
  }
}
