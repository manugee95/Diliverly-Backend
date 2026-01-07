import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './providers/payments.service';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('payments')
export class PaymentsController {
  constructor(
    /**
     * Inject Payments Service
     */
    private readonly paymentService: PaymentsService,
  ) {}

  /**
   * Endpoint to initiate a payment
   */
  @ApiOperation({
    summary: 'Initiate a payment for a request',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initiated successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'ID of the delivery request to initiate payment for',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Post('/initiate/:requestId')
  public async initiatePayment(
    @Req() req,
    @Param('requestId') requestId: number,
  ) {
    const userId = req.user.id;
    return await this.paymentService.initiatePayment(userId, requestId);
  }

  /**
   * Endpoint to verify a payment
   */
  @ApiOperation({
    summary: 'Verify a payment by its reference',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified successfully.',
  })
  @ApiQuery({
    name: 'reference',
    type: 'string',
    required: true,
    description: 'The reference of the payment to verify',
    example: 'ref123456',
  })
  @UseGuards(VendorGuard)
  @Get('verify')
  public async verfifyPayment(@Query('reference') reference: string) {
    return await this.paymentService.verifyPayment(reference);
  }
}
