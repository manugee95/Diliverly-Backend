import {
  Controller,
  Post,
  Req,
  Headers,
  Get,
  Query,
  Res,
  BadRequestException,
  UseInterceptors,
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
  @UseInterceptors()
  async approveTransfer(@Req() req, @Res() res): Promise<void> {
    try {
      this.paystack.handleTransferApproval(req.body).catch(console.error);

      res.status(200).send('ok');
      return;
    } catch (error) {
      console.error(error);

      res.status(200).send('handled');
      return;
    }
  }

}
