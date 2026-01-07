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
import { OrdersService } from './providers/orders.service';
import { CreateOrderDto } from './dtos/createOrder.dto';
import { GetOrdersDto } from './dtos/getOrders.dto';
import { MarkDeliveredDto } from './dtos/markDelivered.dto';
import { VendorDecisionDto } from './dtos/vendorDecision.dto';
import { CancelOrderItemDto } from './dtos/cancelOrderItem.dto';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { AgentGuard } from 'src/auth/guards/roles/agent.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('orders')
export class OrdersController {
  constructor(
    /**
     * Injecting Orders Service
     */
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Endpoint to create orderitem
   */
  @ApiOperation({
    summary: 'Create a new order item',
  })
  @ApiResponse({
    status: 201,
    description: 'Order item created successfully.',
  })
  @UseGuards(VendorGuard)
  @Post()
  public async createOrderItem(@Req() req, @Body() dto: CreateOrderDto) {
    const userId = req.user.id;
    return this.ordersService.createOrderItem(userId, dto);
  }

  /**
   * Endpoint to get orders assigned to an agent
   */
  @ApiOperation({
    summary: 'Get orders assigned to the logged-in agent',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully.',
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
  @Get('agent/my-orders')
  async getOrdersAssignedToAgent(@Req() req, @Query() dto: GetOrdersDto) {
    const userId = req.user.id;
    return this.ordersService.getOrdersAssignedToAgent(userId, dto);
  }

  /**
   * Endpoint to get orders for a vendor
   */
  @ApiOperation({
    summary: 'Get orders for the logged-in vendor',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully.',
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
  @UseGuards(VendorGuard)
  @Get('vendor/my-orders')
  async getOrdersForVendor(@Req() req, @Query() dto: GetOrdersDto) {
    const userId = req.user.id;
    return this.ordersService.getOrdersForVendor(userId, dto);
  }

  /**
   * Endpoint to get orderItems
   */
  @ApiOperation({
    summary: 'Get order items for a specific order',
  })
  @ApiResponse({
    status: 200,
    description: 'Order items retrieved successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'The Order Id',
    example: 5,
  })
  @Get(':orderId/items')
  async getOrderItems(@Param('orderId') orderId: number) {
    return this.ordersService.getOrderItems(orderId);
  }

  /**
   * Endpoint to mark order item as delivered
   */
  @ApiOperation({
    summary: 'Mark an order item as delivered',
  })
  @ApiResponse({
    status: 200,
    description: 'Order item marked as delivered successfully.',
  })
  @UseGuards(AgentGuard)
  @Post('mark-delivered')
  async markDelivered(@Req() req, @Body() dto: MarkDeliveredDto) {
    const userId = req.user.id;
    return this.ordersService.markDelivered(userId, dto);
  }

  /**
   * Endpoint for vendor to approve cod
   */
  @ApiOperation({
    summary: 'Vendor decision on COD order item',
  })
  @ApiResponse({
    status: 200,
    description: 'Vendor decision recorded successfully.',
  })
  @UseGuards(VendorGuard)
  @Post('vendor-decision')
  async codVendorDecision(@Req() req, @Body() dto: VendorDecisionDto) {
    const userId = req.user.id;
    return this.ordersService.codVendorDecision(userId, dto);
  }

  /**
   * Endpoint to cancel an order item
   */
  @ApiOperation({
    summary: 'Cancel an order item',
  })
  @ApiResponse({
    status: 200,
    description: 'Order item cancelled successfully.',
  })
  @UseGuards(AgentGuard)
  @Post('cancel-order-item')
  async cancelOrderItem(@Req() req, @Body() dto: CancelOrderItemDto) {
    const userId = req.user.id;
    return this.ordersService.cancelOrderItem(userId, dto);
  }
}
