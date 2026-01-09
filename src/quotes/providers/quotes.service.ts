import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Quote } from '../entities/quote.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { DeliveryCost } from '../entities/deliveryCost.entity';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { CreateQuoteDto } from '../dtos/create-quote.dto';
import { Vendor } from 'src/vendor/vendor.entity';
import { QuoteStatus } from '../enums/quoteStatus.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from 'src/common/providers/cache.service';
import { CacheTTL } from 'src/common/cache/cacheTTL';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { GetQuoteDto } from '../dtos/get-quote.dto';
import { Agent } from 'src/agent/agent.entity';

@Injectable()
export class QuotesService {
  constructor(
    /**
     * Injecting Quote Repository
     */
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    /**
     * Injecting DeliveryCost Repository
     */
    @InjectRepository(DeliveryCost)
    private readonly deliveryCostRepo: Repository<DeliveryCost>,

    /**
     * Injecting DeliveryRequest Repository
     */
    @InjectRepository(DeliveryRequest)
    private readonly deliveryRequestRepo: Repository<DeliveryRequest>,

    /**
     * Injecting Agent Repository
     */
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,

    /**
     * Injecting Vendor Repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Injecting Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,
  ) {}

  /**
   * Method to create a quote for a delivery request
   */

  // async createQuote(userId: number, dto: CreateQuoteDto): Promise<Quote> {
  //   const { requestId, deliveryCosts } = dto;

  //   const agent = await this.agentRepo.findOne({
  //     where: { user: { id: userId } },
  //   });

  //   if (!agent) throw new NotFoundException('Agent not found');

  //   const request = await this.deliveryRequestRepo.findOne({
  //     where: { id: requestId },
  //     relations: ['deliveries'],
  //   });
  //   if (!request) throw new NotFoundException('Delivery request not found');

  //   // Validate deliveries belong to this request
  //   const validDeliveryIds = request.deliveries.map((d) => d.id);
  //   for (const { deliveryId } of deliveryCosts) {
  //     if (!validDeliveryIds.includes(deliveryId)) {
  //       throw new BadRequestException(
  //         `Delivery ${deliveryId} does not belong to this request`,
  //       );
  //     }
  //   }

  //   // Calculate subtotal
  //   const subtotal = deliveryCosts.reduce((sum, d) => sum + Number(d.cost), 0);

  //   // Create Agent Quote
  //   const quote = this.quoteRepo.create({
  //     agent,
  //     request,
  //     subtotal,
  //     deliveryCost: deliveryCosts.map((item) => ({
  //       delivery: { id: item.deliveryId },
  //       cost: item.cost,
  //     })),
  //   });

  //   const savedQuote = await this.quoteRepo.save(quote);

  //   // Return clean response
  //   return savedQuote;
  // }

  async createQuote(userId: number, dto: CreateQuoteDto): Promise<Quote> {
    const { requestId, deliveryCosts } = dto;

    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) throw new NotFoundException('Agent not found');

    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId },
      relations: ['deliveries'],
    });
    if (!request) throw new NotFoundException('Delivery request not found');

    // Prevent duplicate quote by same agent
    const existingQuote = await this.quoteRepo.findOne({
      where: {
        agent: { id: agent.id },
        request: { id: request.id },
      },
    });

    if (existingQuote) {
      throw new BadRequestException(
        'You have already submitted a quote for this delivery request',
      );
    }

    // Validate deliveries belong to this request
    const validDeliveryIds = request.deliveries.map((d) => d.id);
    for (const { deliveryId } of deliveryCosts) {
      if (!validDeliveryIds.includes(deliveryId)) {
        throw new BadRequestException(
          `Delivery ${deliveryId} does not belong to this request`,
        );
      }
    }

    // Calculate subtotal
    const subtotal = deliveryCosts.reduce((sum, d) => sum + Number(d.cost), 0);

    // Create Agent Quote
    const quote = this.quoteRepo.create({
      agent,
      request,
      subtotal,
      deliveryCost: deliveryCosts.map((item) => ({
        delivery: { id: item.deliveryId },
        cost: item.cost,
      })),
    });

    const savedQuote = await this.quoteRepo.save(quote);

    return savedQuote;
  }

  /**
   * Method to get all quotes for a delivery request
   */
  async getQuotesForRequest(
    userId: number,
    requestId: number,
    quoteQuery: GetQuoteDto,
  ) {
    // get vendor user id
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // ensure this request belongs to the vendor
    const request = await this.deliveryRequestRepo.findOne({
      where: {
        id: requestId,
        vendor: { id: vendor.id },
      },

      relations: ['vendor'],
    });

    if (!request) {
      throw new BadRequestException('Request not found or not owned by vendor');
    }

    // Check cache first
    const cacheKey = `vendor:${vendor.id}:quotes`;

    const cached = await this.cacheManager.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // get all quotes for this request
    const quotes = await this.paginationProvider.paginateQuery(
      {
        page: quoteQuery.page || 1,
        limit: quoteQuery.limit || 10,
      },
      this.quoteRepo,
      {
        where: { request: { id: requestId } },
        relations: ['agent', 'deliveryCost.delivery'],
        order: { createdAt: 'ASC' },
      },
    );

    // Store in cache for future requests
    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(quotes),
      CacheTTL.AgentOrders,
    );

    return quotes;
  }

  /**
   * Method to accept a quote
   */
  async acceptQuote(userId: number, quoteId: number) {
    const quote = await this.quoteRepo.findOne({
      where: { id: quoteId },
      relations: ['request', 'request.vendor'],
    });

    if (!quote) throw new BadRequestException('Quote not found');

    if (quote.request.vendor.user.id !== userId) {
      throw new ForbiddenException('You cannot accept this quote');
    }

    // 1) Set this quote to ACCEPTED
    quote.status = QuoteStatus.ACCEPTED;
    await this.quoteRepo.save(quote);

    // 2) Decline all other quotes for this request
    await this.quoteRepo.update(
      {
        request: { id: quote.request.id },
        id: Not(quote.id),
      },
      { status: QuoteStatus.DECLINED },
    );

    return { message: 'Quote accepted successfully' };
  }
}
