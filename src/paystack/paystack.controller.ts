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
  async approveTransfer(@Req() req, @Res() res) {
    console.log('Approve transfer hit');

    // 1. Extract transfer details
    const event = req.body;

    // 2. Run business logic
    const approved = await this.paystack.handleTransferApproval(event);

    if (!approved) {
      throw new BadRequestException();
    }

    // return 200 response to Paystack
    return res.status(200).send('Transfer approved');
  }
}
