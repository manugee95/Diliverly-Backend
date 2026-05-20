import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './providers/reviews.service';
import { RateAgentDto } from './dtos/rate-agent.dto';
import { GetReviewsDto } from './dtos/get-review.dto';
import { VendorGuard } from '../auth/guards/roles/vendor.guard';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AgentGuard } from '../auth/guards/roles/agent.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Agent } from '../agent/agent.entity';
import { Repository } from 'typeorm';

@Controller('reviews')
export class ReviewsController {
  constructor(
    /**
     * Inject Reviews Service
     */
    private readonly reviewsService: ReviewsService,

    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  /**
   * Endpoint to rate an agent for a specific order
   */
  @ApiOperation({
    summary: 'Rate an agent for a specific order',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent rated successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'ID of the order to rate the agent for',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Post('/:orderId/rate-agent')
  async rateAgent(
    @Req() req,
    @Body() dto: RateAgentDto,
    @Param('orderId') orderId: number,
  ) {
    const userId = req.user.id;
    return this.reviewsService.rateAgent(userId, orderId, dto);
  }

  /**
   * Endpoint to get agent reviews
   */
  @ApiOperation({
    summary: 'Get reviews for a specific agent',
  })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully.',
  })
  @UseGuards(AgentGuard)
  @Get('/me')
  async reviewsByAgent(@Req() req, @Query() dto: GetReviewsDto) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: req.user.id } },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.reviewsService.findReviewsByAgent(agent.id, dto);
  }

  /**
   * Endpoint to get reviews for a specific agent
   */
  @ApiOperation({
    summary: 'Get reviews for a specific agent',
  })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'ID of the agent to get reviews for',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Get('/:agentId')
  async findReviewsByAgent(
    @Param('agentId') agentId: number,
    @Query() dto: GetReviewsDto,
  ) {
    return this.reviewsService.findReviewsByAgent(agentId, dto);
  }

  /**
   * Check if vendor already reviewed agent
   */
  @ApiOperation({
    summary: 'Check if a vendor already reviewed agent',
  })
  @ApiResponse({
    status: 200,
    description: 'Review checked successfully',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'ID of the order',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Get('check-review/:orderId')
  async checkReview(
    @Req() req,
    @Param('orderId')
    orderId: number,
  ) {
    const vendorId = req.user.id;

    return await this.reviewsService.hasVendorReviewedAgent(vendorId, orderId);
  }
}
