import {
  Controller,
  Post,
  Req,
  Headers,
  Get,
  Query,
  Res,
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
  async approveTransfer(
    @Req() req,
    @Res() res,
    @Headers('x-paystack-signature') signature: string,
  ) {
    try {

      console.log('Approve transfer hit');
      console.log('Signature:', signature);

      // 1. Verify request is truly from Paystack
      await this.paystack.verifyWebhookSignature(req.rawBody, signature);

      // 2. Extract transfer details
      const event = req.body;

      // 3. Run business logic
      const approved = await this.paystack.handleTransferApproval(event);

      if (approved) {
        return res.sendStatus(200); // ✅ approve
      } else {
        return res.sendStatus(400); // ❌ reject
      }
    } catch (error) {
      return res.sendStatus(400);
    }
  }
}
