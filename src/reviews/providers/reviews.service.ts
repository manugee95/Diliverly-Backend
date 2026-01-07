import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/orders/entities/order.entity';
import { Repository } from 'typeorm';
import { Review } from '../review.entity';
import { RateAgentDto } from '../dtos/rate-agent.dto';
import { OrderStatus } from 'src/orders/enums/orderStatus.enum';
import { Agent } from 'src/agent/entities/agent.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import { GetReviewsDto } from '../dtos/get-review.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';

@Injectable()
export class ReviewsService {
  constructor(
    /**
     * Inject Order repository
     */
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    /**
     * Inject Review repository
     */
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    /**
     * Inject Agent repository
     */
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,

    /**
     * Inject Vendor repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Inject Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  async rateAgent(userId: number, orderId: number, dto: RateAgentDto) {
    const { rating, review } = dto;

    // Find vendor
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) throw new UnauthorizedException('Vendor not found');

    // Find order + load review relation
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['vendor', 'vendor.user', 'items', 'items.agent', 'review'],
    });

    if (!order) throw new NotFoundException('Order not found');

    // Confirm vendor owns this order
    if (order.vendor.id !== vendor.id) {
      throw new UnauthorizedException('You cannot rate an order not yours');
    }

    // Confirm order is complete
    if (order.status !== OrderStatus.COMPLETE) {
      throw new BadRequestException('Order must be completed before rating');
    }

    // Check if already reviewed
    if (order.review) {
      throw new BadRequestException('Order already reviewed');
    }

    // Get agent
    const agent = order.items[0]?.agent;
    if (!agent) throw new BadRequestException('Agent not assigned');

    // Calculate rating
    const newRatingCount = agent.rating_count + 1;
    const newRatingAvg =
      (agent.rating_avg * agent.rating_count + rating) / newRatingCount;

    // Update agent safely
    await this.agentRepo.update(agent.id, {
      rating_avg: Number(newRatingAvg.toFixed(1)),
      rating_count: newRatingCount,
    });

    // Create review
    const agentReview = this.reviewRepo.create({
      agent: { id: agent.id },
      vendor: { id: vendor.id },
      order: { id: order.id },
      comment: review,
      rating,
    });

    await this.reviewRepo.save(agentReview);

    return { message: 'Thank you for leaving a review' };
  }

  async findReviewsByAgent(
    agentId: number,
    reviewQuery: GetReviewsDto,
  ): Promise<Paginated<Review>> {
    const reviews = await this.paginationProvider.paginateQuery(
      {
        page: reviewQuery.page || 1,
        limit: reviewQuery.limit || 10,
      },
      this.reviewRepo,
      {
        where: { agent: { id: agentId } },
        relations: ['vendor', 'vendor.user', 'order'],
        order: { createdAt: 'DESC' },
      },
    );

    return reviews;
  }
}
