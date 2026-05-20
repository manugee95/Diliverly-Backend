import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { GetDisputesDto } from './dtos/getDisputes.dto';
import { GetDisputeMessagesDto } from './dtos/getDisputeMessages.dto';

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
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.disputeService.sendDisputeMessage(
      req.user.id,
      disputeId,
      message,
      file,
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

  /**
   * Endpoint to get all disputes
   */
  @ApiOperation({
    summary: 'Get all disputes',
  })
  @ApiResponse({
    status: 201,
    description: 'disputes fetched successfully.',
  })
  @Get('')
  async getAllDisputes(@Req() req, @Query() query: GetDisputesDto) {
    return await this.disputeService.getAllDisputes(req.user.id, query);
  }

  /**
   * Endpoint to get all messages for a dispute
   */
  @ApiOperation({
    summary: 'Get all messges for a dispute',
  })
  @ApiResponse({
    status: 201,
    description: 'messages fetched successfully.',
  })
  @Get('/:disputeId/messages')
  async getDisputeMessages(
    @Req() req,
    @Param('disputeId') disputeId: number,
    @Query() query: GetDisputeMessagesDto,
  ) {
    return await this.disputeService.getDisputeMessages(
      req.user.id,
      disputeId,
      query,
    );
  }
}
