import {
  Controller,
  Post,
  Req,
  Headers,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { PaystackService } from './providers/paystack.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { AuthType } from '../auth/enums/auth-type.enum';

@Controller('paystack')
export class PaystackController {
  constructor(private readonly paystack: PaystackService) {}

  /**
   * Endpoint to verify a payment
   */
  @Get('verify')
  public async verfifyPayment(@Query('reference') reference: string) {
    return await this.paystack.verifyTransaction(reference);
  }

  /**
   * Endpoint to handle transfer approval
   */
  @Auth(AuthType.None)
  @Post('approve-transfer')
  async approveTransfer(@Req() req): Promise<{ status: string }> {
    console.log('Approve transfer hit');

    try {
      await this.paystack.handleTransferApproval(req.body);
      return { status: 'ok' };
    } catch (error) {
      console.error('Webhook error:', error);
      return { status: 'handled' };
    }
  }
}
