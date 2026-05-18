import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../../orders/entities/order.entity';
import { DataSource, Repository } from 'typeorm';
import { Review } from '../review.entity';
import { RateAgentDto } from '../dtos/rate-agent.dto';
import { OrderStatus } from '../../orders/enums/orderStatus.enum';
import { Vendor } from '../../vendor/vendor.entity';
import { GetReviewsDto } from '../dtos/get-review.dto';
import { Paginated } from '../../common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';
import { Agent } from '../../agent/agent.entity';
import { MailerService } from '../../mailer/providers/mailer.service';
import { calculateTrustScore } from '../../common/utils/trust-score.util';

@Injectable()
export class ReviewsService {
  constructor(
    /**
     * Inject Review repository
     */
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    /**
     * Inject vendor repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Inject Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Inject DataSource for transactions
     */
    private readonly dataSource: DataSource,

    /**
     * Inject Mail Service
     */
    private readonly mailService: MailerService,
  ) {}

  private async notifyAgent(payload: {
    agentEmail: string;
    agentName: string;
    vendorName: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.agentEmail,
        `${payload.vendorName} Just Left You A Review!`,
        'order-review',
        {
          agentName: payload.agentName,
          vendorName: payload.vendorName,
        },
        `You have a new review from ${payload.vendorName}!`,
      );
    } catch (error) {
      console.error('Failed to send agent email:', error);
    }
  }

  async rateAgent(userId: number, orderId: number, dto: RateAgentDto) {
    const { rating, review } = dto;

    return await this.dataSource.transaction(async (manager) => {
      const vendorRepo = manager.getRepository(Vendor);
      const orderRepo = manager.getRepository(Order);
      const agentRepo = manager.getRepository(Agent);
      const reviewRepo = manager.getRepository(Review);

      // 1) Find vendor
      const vendor = await vendorRepo.findOne({
        where: { user: { id: userId } },
      });

      if (!vendor) throw new UnauthorizedException('Vendor not found');

      // 2) Load order
      const order = await orderRepo.findOne({
        where: { id: orderId },
        relations: ['vendor', 'items', 'items.agent', 'review'],
      });

      if (!order) throw new NotFoundException('Order not found');

      if (order.vendor.id !== vendor.id) {
        throw new UnauthorizedException('You cannot rate an order not yours');
      }

      if (order.status !== OrderStatus.COMPLETE) {
        throw new BadRequestException('Order must be completed before rating');
      }

      if (order.review) {
        throw new BadRequestException('Order already reviewed');
      }

      // 3) Get agent ID
      const agentId = order.items[0]?.agent?.id;
      if (!agentId) throw new BadRequestException('Agent not assigned');

      // 4) Lock agent row (CRITICAL)
      const agent = await agentRepo.findOne({
        where: { id: agentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!agent) throw new NotFoundException('Agent not found');

      // Fetch agent full graph
      const agentFull = await agentRepo.findOne({
        where: { id: agentId },
        relations: ['user'],
      });

      if (!agentFull)
        throw new NotFoundException('Agent full details not found');

      // 5) Compute new rating safely
      const newRatingCount = agent.rating_count + 1;
      const newRatingAvg =
        (agent.rating_avg * agent.rating_count + rating) / newRatingCount;

      const roundedRatingAvg = Number(newRatingAvg.toFixed(1));

      // 6) Build updated agent snapshot
      const updatedAgent: Agent = {
        ...agent,
        rating_avg: roundedRatingAvg,
        rating_count: newRatingCount,
      };

      // 7) Recalculate trust score
      const trustScore = calculateTrustScore(updatedAgent);

      // 8) Persist agent updates
      await agentRepo.update(agent.id, {
        rating_avg: roundedRatingAvg,
        rating_count: newRatingCount,
        trust_score: trustScore,
      });

      // 9) Create review
      const agentReview = reviewRepo.create({
        agent: { id: agent.id },
        vendor: { id: vendor.id },
        order: { id: order.id },
        comment: review,
        rating,
      });

      await reviewRepo.save(agentReview);

      // 10) Notify agent about new review (async, no need to await)
      this.notifyAgent({
        agentEmail: agentFull.user.email,
        agentName: agentFull.businessName || agentFull.user.firstName,
        vendorName: vendor.businessName || vendor.user.firstName,
      });

      return { message: 'Thank you for leaving a review' };
    });
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

  /**
   * Check if vendor already reviewed agent
   */
  async hasVendorReviewedAgent(
    userId: number,
    orderId: number,
  ): Promise<boolean> {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    const existingReview = await this.reviewRepo.findOne({
      where: {
        vendor: {
          id: vendor?.id,
        },
        order: {
          id: orderId,
        },
      },
    });

    return !!existingReview;
  }
}
