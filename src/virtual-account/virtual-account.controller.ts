import { Controller, Post, Req, Headers } from '@nestjs/common';
import { PaystackService } from 'src/paystack/providers/paystack.service';
import { VirtualAccountService } from './providers/virtual-account.service';

@Controller('virtual-account')
export class VirtualAccountController {
  constructor(
    private readonly paystackService: PaystackService,
    private readonly virtualAccountService: VirtualAccountService,
  ) {}

  @Post()
  async handleWebhook(
    @Req() req,
    @Headers('x-paystack-signature') signature: string,
  ) {
    console.log('Webhook hit');
    console.log('Signature:', signature);

    await this.paystackService.verifyWebhookSignature(req.rawBody, signature);

    const event = req.body;

    if (event.event === 'charge.success') {
      await this.virtualAccountService.handleSuccessfulCharge(event.data);
    }

    return { status: 'ok' };
  }
}
