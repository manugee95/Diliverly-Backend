import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { WalletFundingService } from './providers/wallet-funding.service';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { WalletsService } from './providers/wallets.service';
import * as crypto from 'crypto';
import { CurrencyConvertProvider } from 'src/common/providers/currency-convert.provider';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';
import { PaystackService } from 'src/paystack/providers/paystack.service';

@Controller('wallets')
export class WalletsController {
  constructor(
    /**
     * Inject WalletsService
     */
    private readonly walletFundingService: WalletFundingService,
    private readonly walletsService: WalletsService,
    private readonly currencyConvert: CurrencyConvertProvider,
    private readonly paystackService: PaystackService
  ) {}

  /**
   * Endpoint to initiate wallet funding
   */
  @ApiOperation({
    summary:
      'Initiates wallet funding by generating a Paystack authorization URL for the specified amount.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Initiates wallet funding and returns Paystack authorization URL.',
    schema: {
      example: {
        authorizationUrl: 'https://paystack.com/pay/abc123',
      },
    },
  })
  @ApiParam({
    name: 'amount',
    type: 'number',
    required: true,
    description: 'The amount to fund the wallet with (in Naira).',
    example: 5000,
  })
  @Post('fund')
  async fundWallet(@Req() req, @Body() body: { amount: number }) {
    const user = req.user.id;
    return this.walletFundingService.initiateFunding(user, body.amount);
  }

  /**
   * Endpoint to verify and fund wallet after Paystack callback
   */
  @ApiOperation({
    summary:
      "Verifies Paystack payment and funds the user's wallet accordingly.",
  })
  @ApiResponse({
    status: 201,
    description:
      "Verifies Paystack payment and funds the user's wallet accordingly.",
    schema: {
      example: {
        authorizationUrl: 'https://paystack.com/pay/abc123',
      },
    },
  })
  @ApiQuery({
    name: 'reference',
    type: 'string',
    required: true,
    description:
      'The unique payment reference returned by Paystack after payment.',
    example: 'abc123',
  })
  @Get('verify')
  public async verifyPayment(@Query('reference') reference: string) {
    return await this.walletFundingService.verifyAndFundWallet(reference);
  }

  /**
   * Endpoint to handle Paystack webhook events.
   */


  // @ApiOperation({
  //   summary: 'Handles Paystack webhook events for wallet funding.',
  // })
  // @Auth(AuthType.None)
  // @Post('webhook/paystack')
  // @HttpCode(HttpStatus.OK)
  // public async handlePaystackWebhook(
  //   @Req() req,
  //   @Headers('x-paystack-signature') signature: string,
  // ) {
  //   try {
  //     console.log('Webhook hit');
  //     console.log('Signature:', signature);

  //     await this.paystackService.verifyWebhookSignature(req.rawBody, signature)

  //     const event = req.body;

  //     await this.walletFundingService.handleSuccessfulCharge(event);

  //     return;
  //   } catch (error) {
  //     // NEVER throw in webhook
  //     return;
  //   }
  // }

  
  /**
   * Endpoint to get or create a wallet for a user.
   */
  @ApiOperation({
    summary: "Retrieves the user's wallet or creates one if it doesn't exist.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Retrieves the user's wallet or creates one if it doesn't exist.",
  })
  @Get()
  public async getOrCreateWallet(@Req() req) {
    const userId = req.user.id;
    const wallet = await this.walletsService.getOrCreateWallet(userId);

    return {
      id: wallet.id,
      availableBalance: this.currencyConvert.formatNaira(wallet.availableBalance),
      escrowBalance: this.currencyConvert.formatNaira(wallet.escrowBalance),
      currency: wallet.currency,
    };
  }
}
