import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { WalletFundingService } from './providers/wallet-funding.service';

@Controller('wallets')
export class WalletsController {
  constructor(
    /**
     * Inject WalletsService
     */
    private readonly walletFundingService: WalletFundingService,
  ) {}

  /**
   * Endpoint to initiate wallet funding
   */
  @Post('fund')
  async fundWallet(@Req() req, @Body() body: { amount: number }) {
    const user = req.user.id;
    return this.walletFundingService.initiateFunding(user, body.amount);
  }

  /**
   * Endpoint to verify and fund wallet after Paystack callback
   */
  @Get('verify')
  public async verfifyPayment(@Query('reference') reference: string) {
    return await this.walletFundingService.verifyAndFundWallet(reference);
  }
}
