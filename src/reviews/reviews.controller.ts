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
import { ReviewsService } from './providers/reviews.service';
import { RateAgentDto } from './dtos/rate-agent.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { UserRole } from 'src/users/enums/userRole.enum';
import { GetReviewsDto } from './dtos/get-review.dto';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('reviews')
export class ReviewsController {
  constructor(
    /**
     * Inject Reviews Service
     */
    private readonly reviewsService: ReviewsService,
  ) {}

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
}
