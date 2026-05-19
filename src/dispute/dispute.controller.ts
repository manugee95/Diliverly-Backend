import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateDisputeDto } from './dtos/createDispute.dto';
import { DisputeService } from './providers/dispute.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/roles/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('dispute')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  /**
   * Endpoint to open a dispute
   */
  @ApiOperation({
    summary: 'Open a dispute for an order',
  })
  @ApiResponse({
    status: 201,
    description: 'Dispute created successfully.',
  })
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @Post('/:orderId/open-dispute')
  async createDispute(
    @Req() req,
    @Param('orderId') orderId: number,
    @Body() dto: CreateDisputeDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.disputeService.createDispute(
      req.user.id,
      orderId,
      dto,
      file,
    );
  }

  /**
   * Endpoint to send dispute messages
   */
  @ApiOperation({
    summary: 'Send dispute messages between admin, vendor and agent',
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully.',
  })
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @Post('/:disputeId/send-message')
  async sendDisputeMessage(
    @Req() req,
    @Param('disputeId') disputeId: number,
    @Body() message: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return await this.disputeService.sendDisputeMessage(
      req.user.id,
      disputeId,
      message,
      file
    );
  }

  /**
   * Endpoint to admin to resolve a dispute
   */
  @ApiOperation({
    summary: 'Dispute resolve by admin',
  })
  @ApiResponse({
    status: 201,
    description: 'Resolved successfully.',
  })
  @UseGuards(AdminGuard)
  @Post('/:disputeId/resolve')
  async resolveDispute(
    @Req() req,
    @Param('disputeId') disputeId: number,
    @Body() resolution: string,
  ) {
    return await this.disputeService.resolveDispute(
      req.user.id,
      disputeId,
      resolution,
    );
  }
}
