import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Quote } from '../entities/quote.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
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
import { MailerService } from 'src/mailer/providers/mailer.service';

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

  //   // Prevent duplicate quote by same agent
  //   const existingQuote = await this.quoteRepo.findOne({
  //     where: {
  //       agent: { id: agent.id },
  //       request: { id: request.id },
  //     },
  //   });

  //   if (existingQuote) {
  //     throw new BadRequestException(
  //       'You have already submitted a quote for this delivery request',
  //     );
  //   }

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

    const validDeliveryIds = request.deliveries.map((d) => d.id);

    for (const { deliveryId } of deliveryCosts) {
      if (!validDeliveryIds.includes(deliveryId)) {
        throw new BadRequestException(
          `Delivery ${deliveryId} does not belong to this request`,
        );
      }
    }

    const subtotal = deliveryCosts.reduce((sum, d) => sum + Number(d.cost), 0);

    // Map real delivery entities
    const deliveriesMap = new Map(request.deliveries.map((d) => [d.id, d]));

    const quote = this.quoteRepo.create({
      agent,
      request,
      subtotal,
      deliveryCost: deliveryCosts.map((item) => ({
        delivery: deliveriesMap.get(item.deliveryId), // ✅ FIXED
        cost: item.cost,
      })),
    });

    return await this.quoteRepo.save(quote);
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
   * Method to get all quotes submitted by an agent
   */
  async getQuotesForAgent(userId: number, quoteQuery: GetQuoteDto) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) throw new NotFoundException('Agent not found');

    // Dynamic filter
    const where: any = {
      agent: { id: agent.id },
    };

    if (quoteQuery.status) {
      where.status = quoteQuery.status;
    }

    const quotes = await this.paginationProvider.paginateQuery(
      {
        page: quoteQuery.page || 1,
        limit: quoteQuery.limit || 10,
      },
      this.quoteRepo,
      {
        where,
        relations: ['request', 'request.vendor'],
        order: { createdAt: 'ASC' },
      },
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

  // async acceptQuote(userId: number, quoteId: number) {
  //   const quote = await this.quoteRepo.findOne({
  //     where: { id: quoteId },
  //     relations: ['request', 'request.vendor', 'agent', 'agent.user'],
  //   });

  //   if (!quote) throw new BadRequestException('Quote not found');

  //   if (quote.request.vendor.user.id !== userId) {
  //     throw new ForbiddenException('You cannot accept this quote');
  //   }

  //   // 1) Set this quote to ACCEPTED
  //   quote.status = QuoteStatus.ACCEPTED;
  //   await this.quoteRepo.save(quote);

  //   // 2) Decline all other quotes for this request
  //   await this.quoteRepo.update(
  //     {
  //       request: { id: quote.request.id },
  //       id: Not(quote.id),
  //     },
  //     { status: QuoteStatus.DECLINED },
  //   );

  //   // Notify agent by email
  //   await this.mailService.sendTemplate(
  //     quote.agent.user.email,
  //     'Your delivery quote has been accepted',
  //     'vendor-accepts-quote',
  //     {
  //       agentName: quote.agent.businessName || quote.agent.user.firstName,
  //       vendorName:
  //         quote.request.vendor.businessName ||
  //         quote.request.vendor.user.firstName,
  //       deliveryTitle: quote.request.title,
  //     },
  //   );

  //   return { message: 'Quote accepted successfully' };
  // }

  async acceptQuote(userId: number, quoteId: number) {
    return this.dataSource
      .transaction(async (manager) => {
        const quoteRepo = manager.getRepository(Quote);
        const requestRepo = manager.getRepository(DeliveryRequest);

        const quote = await quoteRepo.findOne({
          where: { id: quoteId },
          relations: ['request'], 
        });

        if (!quote) throw new BadRequestException('Quote not found');

        // 2. Lock request
        const request = await requestRepo.findOne({
          where: { id: quote.request.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!request) throw new BadRequestException('Request not found');

        // 3. Load relations AFTER lock
        const fullQuote = await quoteRepo.findOne({
          where: { id: quoteId },
          relations: ['request', 'request.vendor', 'agent', 'agent.user'],
        });

        if (!fullQuote) throw new BadRequestException('Quote not found');

        // Ownership check
        if (fullQuote.request.vendor.user.id !== userId) {
          throw new ForbiddenException('You cannot accept this quote');
        }

        // Prevent double acceptance
        const existingAccepted = await quoteRepo.findOne({
          where: {
            request: { id: request.id },
            status: QuoteStatus.ACCEPTED,
          },
        });

        if (existingAccepted) {
          throw new BadRequestException('A quote has already been accepted');
        }

        // Reject all quotes
        await quoteRepo.update(
          { request: { id: request.id } },
          { status: QuoteStatus.DECLINED },
        );

        // Accept this one
        quote.status = QuoteStatus.ACCEPTED;
        await quoteRepo.save(quote);

        return {
          agentEmail: fullQuote.agent.user.email,
          agentName:
            fullQuote.agent.businessName || fullQuote.agent.user.firstName,
          vendorName:
            fullQuote.request.vendor.businessName ||
            fullQuote.request.vendor.user.firstName,
          deliveryTitle: fullQuote.request.title,
        };
      })
      .then(async (result) => {
        // Outside transaction
        await this.mailService.sendTemplate(
          result.agentEmail,
          'Your delivery quote has been accepted',
          'vendor-accepts-quote',
          {
            agentName: result.agentName,
            vendorName: result.vendorName,
            deliveryTitle: result.deliveryTitle,
          },
        );

        return { message: 'Quote accepted successfully' };
      });
  }
}
