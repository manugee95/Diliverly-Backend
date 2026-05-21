import { Controller, Post, Req, Headers } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { AuthType } from '../auth/enums/auth-type.enum';
import { PaystackService } from '../paystack/providers/paystack.service';
import { VirtualAccountService } from '../virtual-account/providers/virtual-account.service';
import { WalletFundingService } from '../wallets/providers/wallet-funding.service';
import { WithdrawalsService } from '../withdrawals/providers/withdrawals.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly walletService: WalletFundingService,
    private readonly vaService: VirtualAccountService,
    private readonly paystackService: PaystackService,
    private readonly withdrawalService: WithdrawalsService,
  ) {}

  private async processWebhook(event: string, data: any) {
    try {
      switch (event) {
        case 'charge.success':
          await this.walletService.handleSuccessfulCharge(data);
          break;

        case 'transfer.success':
          await this.withdrawalService.handleTransferSuccess(data);
          break;

        case 'transfer.failed':
          await this.withdrawalService.handleTransferFailed(data);
          break;

        case 'transfer.reversed':
          await this.withdrawalService.handleTransferReversed(data);
          break;

        case 'dedicatedaccount.assign.success':
          await this.vaService.handleSuccessfulCharge(data);
          break;

        default:
          console.log('Unhandled event:', event);
      }
    } catch (err) {
      console.error(`Error processing ${event}:`, err.message);
    }
  }

  @Auth(AuthType.None)
  @Post('paystack')
  async handlePaystackWebhook(
    @Req() req,
    @Headers('x-paystack-signature') signature: string,
  ) {
    try {
      // console.log('Webhook hit');
      // console.log('Signature:', signature);

      await this.paystackService.verifyWebhookSignature(req.rawBody, signature);

      const event = req.body.event;
      const data = req.body.data;

      // Don't await (important)
      this.processWebhook(event, data);

      return { status: 'ok' }; //always respond fast
    } catch (error) {
      console.error('Webhook error:', error.message);

      // Still return 200 to prevent retries
      return { status: 'received' };
    }
  }
}
