import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DeliveryRequestService } from './providers/delivery-requests.service';
import { CreateDeliveryRequestDto } from './dtos/create-delivery-request.dto';
import { GetDeliveryRequestsDto } from './dtos/get-delivery-requests.dto';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { AgentGuard } from 'src/auth/guards/roles/agent.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { log } from 'console';
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider';
import { agent } from 'supertest';

@Controller('delivery-request')
export class DeliveryRequestsController {
  constructor(
    /**
     * Injecting DeliveryRequest service
     */
    private readonly deliveryRequestService: DeliveryRequestService,

    private readonly generateTokensProvider: GenerateTokensProvider,
  ) {}

  /**
   * Endpoint to create delivery request
   */
  @ApiOperation({
    summary: 'Create a new delivery request',
  })
  @ApiResponse({
    status: 201,
    description: 'Delivery request created successfully.',
  })
  @UseGuards(VendorGuard)
  @Post()
  public async createDeliveryRequest(
    @Req() req,
    @Body() dto: CreateDeliveryRequestDto,
  ) {
    const userId = req.user.id;
    return await this.deliveryRequestService.createDeliveryRequest(userId, dto);
  }

  /**
   * Endpoint to send a direct delivery request to an agent
   */
  @ApiOperation({
    summary: 'Send a direct delivery request to an agent',
  })
  @ApiResponse({
    status: 201,
    description: 'Direct delivery request sent successfully.',
  })
  @ApiParam({
    name: 'agentId',
    type: 'number',
    required: true,
    description: 'The Agent Id to send the direct request to',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Post('direct/:agentId')
  public async sendDirectRequest(
    @Req() req,
    @Param('agentId') agentId: number,
    @Body() dto: CreateDeliveryRequestDto,
  ) {
    const userId = req.user.id;
    return await this.deliveryRequestService.sendDirectRequest(userId, agentId, dto);
  }

  /**
   * Endpoint to get all available requests
   */
  @ApiOperation({
    summary: 'Get all available delivery requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Available delivery requests retrieved successfully.',
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'The number of entries returned per query',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'The page number returned per query',
    example: 1,
  })
  @UseGuards(AgentGuard)
  @Get('available')
  public async getAvailableRequests(
    @Req() req,
    @Query() dto: GetDeliveryRequestsDto,
  ) {
    const userId = req.user.id;
    return await this.deliveryRequestService.getAvailableRequests(userId, dto);
  }

  /**
   * Endpoint to get an order summary
   */
  @ApiOperation({
    summary: 'Get order summary',
  })
  @ApiResponse({
    status: 200,
    description: 'Order summary retrieved successfully.',
  })
  @ApiParam({
    name: 'requestId',
    type: 'number',
    required: true,
    description: 'The Delivery Request Id',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Get('order-summary/:requestId')
  public async getOrderSummary(
    @Req() req,
    @Param('requestId') requestId: number,
  ) {
    const userId = req.user.id;
    return await this.deliveryRequestService.getOrderSummary(userId, requestId);
  }

  /**
   * Endpoint to get all vendor requests
   */
  @ApiOperation({
    summary: 'Get all delivery requests for a vendor',
  })
  @ApiResponse({
    status: 200,
    description: 'Vendor delivery requests retrieved successfully.',
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'The number of entries returned per query',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'The page number returned per query',
    example: 1,
  })
  @ApiQuery({
    name: 'status',
    type: 'string',
    required: false,
    description: 'The status of the delivery requests to retrieve',
    example: 'open'
  })
  @UseGuards(VendorGuard)
  @Get('vendor-requests')
  public async getVendorRequests(
    @Req() req,
    @Query() dto: GetDeliveryRequestsDto,
  ) {
    const userId = req.user.id;
    return await this.deliveryRequestService.getVendorRequests(userId, dto);
  }

  /**
   * Endpoint to get a delivery request information
   */
  @ApiOperation({
    summary: 'Get delivery request information',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery request information retrieved successfully.',
  })
  @ApiParam({
    name: 'requestId',
    type: 'number',
    required: true,
    description: 'The Delivery Request Id',
    example: 5,
  })
  @Get('/:requestId')
  public async getRequestInfo(
    @Req() req,
    @Param('requestId') requestId: number,
  ) {

    return await this.deliveryRequestService.getRequestInfo(
      requestId, 
      req.user.id,
      req.user.activeRole,
    );
  }
}
