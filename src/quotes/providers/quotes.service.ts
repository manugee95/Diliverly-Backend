import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Quote } from '../entities/quote.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeliveryCost } from '../entities/deliveryCost.entity';
import { DeliveryRequest } from '../../delivery-requests/entities/delivery-request.entity';
import { CreateQuoteDto } from '../dtos/create-quote.dto';
import { Vendor } from '../../vendor/vendor.entity';
import { QuoteStatus } from '../enums/quoteStatus.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from '../../common/providers/cache.service';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';
import { GetQuoteDto } from '../dtos/get-quote.dto';
import { Agent } from '../../agent/agent.entity';
import { MailerService } from '../../mailer/providers/mailer.service';
import { DashboardCacheProvider } from '../../dashboard-overview/providers/dashboard-overview.provider';
import { DeliveryRequestsCacheProvider } from '../../delivery-requests/providers/delivery-requests.provider';
import { QuotesCacheProvider } from './quotes.provider';

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

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,

    /**
     * Injecting data source for transactions
     */
    private readonly dataSource: DataSource,

    /**
     * Injecting dashboard cache provider
     */
    private readonly dashboardCacheProvider: DashboardCacheProvider,

    /**
     * Injecting Delivery Requests Cache Provider
     */
    private readonly deliveryRequestCacheService: DeliveryRequestsCacheProvider,

    /**
     * Injecting Quotes Cache Provider
     */
    private readonly quotesCacheProvider: QuotesCacheProvider,
  ) {}

  /**
   * Method to create a quote for a delivery request
   */
  async createQuote(userId: number, dto: CreateQuoteDto): Promise<Quote> {
    const { requestId, deliveryCosts } = dto;

    const savedQuote = await this.dataSource.transaction(async (manager) => {
      const agentRepo = manager.getRepository(Agent);
      const requestRepo = manager.getRepository(DeliveryRequest);
      const quoteRepo = manager.getRepository(Quote);

      const agent = await agentRepo.findOne({
        where: { user: { id: userId } },
      });
      if (!agent) throw new NotFoundException('Agent not found');

      const request = await requestRepo.findOne({
        where: { id: requestId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!request) throw new NotFoundException('Delivery request not found');

      const requestWithRelations = await requestRepo.findOne({
        where: { id: requestId },
        relations: ['deliveries', 'vendor', 'vendor.user'],
      });
      if (!requestWithRelations)
        throw new NotFoundException('Delivery request not found');

      const existingQuote = await quoteRepo.findOne({
        where: {
          agent: { id: agent.id },
          request: { id: request.id },
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingQuote) {
        throw new BadRequestException('You have already submitted a quote');
      }

      const subtotal = deliveryCosts.reduce(
        (sum, d) => sum + Number(d.cost),
        0,
      );

      const deliveriesMap = new Map(
        requestWithRelations.deliveries.map((d) => [d.id, d]),
      );

      const quote = quoteRepo.create({
        agent,
        request: requestWithRelations,
        subtotal,
        deliveryCost: deliveryCosts.map((item) => ({
          delivery: deliveriesMap.get(item.deliveryId),
          cost: item.cost,
        })),
      });

      return await quoteRepo.save(quote);
    });

    // AFTER transaction succeeds
    await this.dashboardCacheProvider.invalidateAgent(savedQuote.agent.id);

    await this.quotesCacheProvider.invalidateAgentQuotes(savedQuote.agent.id);

    await this.quotesCacheProvider.invalidateVendorRequestQuotes(
      savedQuote.request.vendor.id,
      savedQuote.request.id,
    );

    // Send email AFTER commit
    await this.mailService.sendTemplate(
      savedQuote.request.vendor.user.email,
      'New Quote Received',
      'vendor-new-quotes',
      {
        vendorName:
          savedQuote.request.vendor.businessName ||
          savedQuote.request.vendor.user.firstName,
        requestTitle: savedQuote.request.title,
        agentName:
          savedQuote.agent.businessName || savedQuote.agent.user.firstName,
      },
      `You just received a new quote for your delivery request ${savedQuote.request.title}`,
    );

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
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const request = await this.deliveryRequestRepo.findOne({
      where: {
        id: requestId,
        vendor: { id: vendor.id },
      },
    });

    if (!request) {
      throw new BadRequestException('Request not found or not owned by vendor');
    }

    const page = quoteQuery.page || 1;
    const limit = quoteQuery.limit || 10;

    // Try cache
    const cached = await this.quotesCacheProvider.getVendorRequestQuotes(
      vendor.id,
      requestId,
      page,
      limit,
    );

    if (cached) return cached;

    // Fetch from DB
    const quotes = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.quoteRepo,
      {
        where: { request: { id: requestId } },
        relations: ['agent', 'agent.user', 'deliveryCost', 'deliveryCost.delivery'],
        order: { createdAt: 'ASC' },
      },
    );

    // Cache result
    await this.quotesCacheProvider.setVendorRequestQuotes(
      vendor.id,
      requestId,
      page,
      limit,
      quotes,
    );

    return quotes;
  }

  /**
   * Method to get all quotes submitted by an agent
   */
  async getQuotesForAgent(userId: number, quoteQuery: GetQuoteDto) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'quotes', 'quotes.request', 'quotes.request.vendor'],
    });

    if (!agent) throw new NotFoundException('Agent not found');

    const page = quoteQuery.page || 1;
    const limit = quoteQuery.limit || 10;
    const status = quoteQuery.status || 'all';

    // Try cache
    const cached = await this.quotesCacheProvider.getAgentQuotes(
      agent.id,
      page,
      limit,
      status,
    );

    if (cached) return cached;

    const where: any = {
      agent: { id: agent.id },
    };

    if (quoteQuery.status) {
      where.status = quoteQuery.status;
    }

    const quotes = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.quoteRepo,
      {
        where,
        relations: ['request', 'request.vendor'],
        order: { createdAt: 'DESC' },
      },
    );

    // Cache
    await this.quotesCacheProvider.setAgentQuotes(
      agent.id,
      page,
      limit,
      status,
      quotes,
    );

    return quotes;
  }

  /**
   * Method to get a single quote by ID
   */
  async getQuoteById(userId: number, quoteId: number) {
    const quote = await this.quoteRepo.findOne({
      where: { id: quoteId },
      relations: ['agent', 'agent.user', 'request', 'request.vendor'],
    });

    if (!quote) throw new NotFoundException('Quote not found');

    // Ensure the user is either the agent who submitted the quote or the vendor who owns the request
    if (
      quote.agent.user.id !== userId &&
      quote.request.vendor.user.id !== userId
    ) {
      throw new ForbiddenException('You are not the owner of this quote');
    }

    return quote;
  }

  /**
   * Method to accept a quote
   */
  async acceptQuote(userId: number, quoteId: number) {
    const result = await this.dataSource.transaction(async (manager) => {
      const quoteRepo = manager.getRepository(Quote);
      const requestRepo = manager.getRepository(DeliveryRequest);

      // 1. Load quote with minimal relation
      const quote = await quoteRepo.findOne({
        where: { id: quoteId },
        relations: ['request'],
      });

      if (!quote) throw new BadRequestException('Quote not found');

      // 2. Lock request (prevent race conditions)
      const request = await requestRepo.findOne({
        where: { id: quote.request.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) throw new BadRequestException('Request not found');

      // 3. Load full quote AFTER lock
      const fullQuote = await quoteRepo.findOne({
        where: { id: quoteId },
        relations: [
          'request',
          'request.vendor',
          'request.vendor.user',
          'agent',
          'agent.user',
        ],
      });

      if (!fullQuote) throw new BadRequestException('Quote not found');

      // 4. Ownership check
      if (fullQuote.request.vendor.user.id !== userId) {
        throw new ForbiddenException('You cannot accept this quote');
      }

      // 5. Prevent double acceptance
      const existingAccepted = await quoteRepo.findOne({
        where: {
          request: { id: request.id },
          status: QuoteStatus.ACCEPTED,
        },
      });

      if (existingAccepted) {
        throw new BadRequestException('A quote has already been accepted');
      }

      // 6. Reject all quotes
      await quoteRepo.update(
        { request: { id: request.id } },
        { status: QuoteStatus.DECLINED },
      );

      // 7. Accept this quote
      fullQuote.status = QuoteStatus.ACCEPTED;
      await quoteRepo.save(fullQuote);

      // 8. RETURN EVERYTHING NEEDED OUTSIDE
      return {
        agentId: fullQuote.agent.id,
        vendorId: fullQuote.request.vendor.id,
        agentEmail: fullQuote.agent.user.email,
        agentName:
          fullQuote.agent.businessName || fullQuote.agent.user.firstName,
        vendorName:
          fullQuote.request.vendor.businessName ||
          fullQuote.request.vendor.user.firstName,
        deliveryTitle: fullQuote.request.title,
      };
    });

    // 10. Invalidate caches
    await this.dashboardCacheProvider.invalidateBoth(
      result.vendorId,
      result.agentId,
    );

    await this.deliveryRequestCacheService.invalidateAgent(result.agentId);

    await this.quotesCacheProvider.invalidateAgentQuotes(result.agentId);
    await this.quotesCacheProvider.invalidateVendorRequestQuotes(
      result.vendorId,
      quoteId,
    );

    return { message: 'Quote accepted successfully' };
  }

  /**
   * Check if an agent already submitted a quote
   */
  async hasAgentSubmittedQuote(
    agentId: number,
    requestId: number,
  ): Promise<boolean> {
    const existingQuote = await this.quoteRepo.findOne({
      where: {
        agent: {
          id: agentId,
        },
        request: {
          id: requestId,
        },
      },
    });

    return !!existingQuote;
  }
}
