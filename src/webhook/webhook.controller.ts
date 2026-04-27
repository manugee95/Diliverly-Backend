import { Controller, Post, Req, Headers } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';
import { PaystackService } from 'src/paystack/providers/paystack.service';
import { VirtualAccountService } from 'src/virtual-account/providers/virtual-account.service';
import { WalletFundingService } from 'src/wallets/providers/wallet-funding.service';
import { WithdrawalsService } from 'src/withdrawals/providers/withdrawals.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly walletService: WalletFundingService,
    private readonly vaService: VirtualAccountService,
    private readonly paystackService: PaystackService,
    private readonly withdrawalService: WithdrawalsService,
  ) {}

  @Auth(AuthType.None)
  @Post('paystack')
  async handlePaystackWebhook(
    @Req() req,
    @Headers('x-paystack-signature') signature: string,
  ) {
    console.log('Webhook hit');
    console.log('Signature:', signature);

    await this.paystackService.verifyWebhookSignature(req.rawBody, signature);

    const event = req.body.event;
    const data = req.body.data;

    switch (event) {
      case 'charge.success':
        return this.walletService.handleSuccessfulCharge(req.body);

      case 'transfer.success':
        return this.withdrawalService.handleTransferSuccess(data);

      case 'transfer.failed':
        return this.withdrawalService.handleTransferFailed(data);

      case 'transfer.reversed':
        return this.withdrawalService.handleTransferReversed(data);

      case 'dedicatedaccount.assign.success':
        return this.vaService.handleSuccessfulCharge(req.body);

      default:
        console.log('Unhandled event:', event);
        return;
    }
  }
}
