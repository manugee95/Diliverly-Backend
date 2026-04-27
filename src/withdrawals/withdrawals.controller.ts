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
import { PaystackService } from 'src/paystack/providers/paystack.service';
import { FinalizeWithdrawalDto } from './dtos/finalize-withdrawal.dto';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(
    /**
     * Inject Withdrawals service
     */
    private readonly withdrawalService: WithdrawalsService,
    private readonly paystackService: PaystackService,
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

  @Post('finalize')
  finalizeWithdrawalOtp(@Body() dto: FinalizeWithdrawalDto) {
    return this.paystackService.finalizeTransfer(dto.transferCode, dto.otp);
  }
}
