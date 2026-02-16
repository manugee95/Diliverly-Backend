import { Controller, Post, Req, Headers, Get, Query } from '@nestjs/common';
import { WalletFundingService } from 'src/wallets/providers/wallet-funding.service';
import { PaystackService } from './providers/paystack.service';
import { Request } from 'express';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('paystack')
export class PaystackController {
  constructor(
    private readonly paystack: PaystackService,
    private readonly walletFundingService: WalletFundingService,
  ) {}

  /**
   * Endpoint to verify a payment
   */
  @ApiOperation({
    summary: 'Verify a payment by its reference',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified successfully.',
  })
  @ApiQuery({
    name: 'reference',
    type: 'string',
    required: true,
    description: 'The reference of the payment to verify',
    example: 'ref123456',
  })
  @Get('verify')
  public async verfifyPayment(@Query('reference') reference: string) {
    return await this.paystack.verifyTransaction(reference);
  }

  /**
   * Endpoint to handle Paystack webhooks
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Verify signature using rawBody
    const rawBody = req.rawBody as Buffer;
    this.paystack.verifyWebhookSignature(rawBody, signature);

    // Process event
    const event = req.body;
    await this.walletFundingService.handlePaystackWebhook(event);

    return { received: true };
  }
}
