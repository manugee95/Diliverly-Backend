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
  async approveTransfer(@Req() req, @Res() res) {
    try {
      console.log('Approve transfer hit');

      // 2. Extract transfer details
      const event = req.body;

      // 3. Run business logic
      const approved = await this.paystack.handleTransferApproval(event);

      if (approved) {
        // Return 200 to approve
        return res.status(200).json({ status: 'success' });
      } else {
        // Return 400 to reject
        return res.status(400).json({ status: 'failed' });
      }
    } catch (error) {
      return res.sendStatus(400);
    }
  }
}
