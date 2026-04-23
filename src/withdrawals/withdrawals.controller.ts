import {
  Body,
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  Res,
} from '@nestjs/common';
import { WithdrawalsService } from './providers/withdrawals.service';
import { CreateWithdrawalDto } from './dtos/withdrawal.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(
    /**
     * Inject Withdrawals service
     */
    private readonly withdrawalService: WithdrawalsService,
  ) {}

  @ApiOperation({
    summary: 'Request a manual withdrawal',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal request submitted successfully.',
  })
  @Post('request')
  async requestWithdrawal(@Req() req, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalService.manualWithdrawal(req.user.id, dto.amount);
  }

  @Post('webhook/paystack')
  @HttpCode(200)
  handlePaystackWebhook(@Req() req, @Res() res) {
    console.log('Webhook received:', req.body);

    res.status(200).send('OK');
  }
}
