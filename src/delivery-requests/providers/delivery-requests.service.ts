import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeliveryRequest } from '../entities/delivery-request.entity';
import { In, Repository } from 'typeorm';
import { Delivery } from '../entities/delivery.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import { CreateDeliveryRequestDto } from '../dtos/create-delivery-request.dto';
import { RequestStatus } from '../enums/requestStatus.enum';
import { GetDeliveryRequestsDto } from '../dtos/get-delivery-requests.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { QuoteStatus } from 'src/quotes/enums/quoteStatus.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from 'src/common/providers/cache.service';
import { CacheTTL } from 'src/common/cache/cacheTTL';
import { Agent } from 'src/agent/agent.entity';

@Injectable()
export class DeliveryRequestService {
  constructor(
    /**
     * Injecting DeliveryRequest repository
     */
    @InjectRepository(DeliveryRequest)
    private readonly deliveryRequestRepo: Repository<DeliveryRequest>,

    /**
     * Injecting DeliveryItem repository
     */
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    /**
     * Injecting Vendor repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    /**
     * Injecting Agent repository
     */
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,

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
   * Method to create a delivery request
   */
  async createDeliveryRequest(
    userId: number,
    dto: CreateDeliveryRequestDto,
  ): Promise<DeliveryRequest> {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const { title, description, state, addresses } = dto;

    // Create the base request
    const deliveryRequest = this.deliveryRequestRepo.create({
      vendor,
      title,
      description,
      state,
      status: RequestStatus.OPEN,
    });

    const savedDeliveryRequest =
      await this.deliveryRequestRepo.save(deliveryRequest);

    // Create individual deliveries
    const deliveries = addresses.map((address) =>
      this.deliveryRepo.create({
        request: savedDeliveryRequest,
        address: address.address,
        deliveryType: address.deliveryType,
      }),
    );

    savedDeliveryRequest.deliveries = deliveries;

    // Save everything
    const savedRequest =
      await this.deliveryRequestRepo.save(savedDeliveryRequest);
    return savedRequest;
  }

  /**
   * Method to get available delivery requests for an agent
   */
  async getAvailableRequests(
    userId: number,
    deliveryRequestQuery: GetDeliveryRequestsDto,
  ): Promise<Paginated<DeliveryRequest>> {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent?.statesCovered || agent.statesCovered.length === 0) {
      throw new BadRequestException('No states covered by this agent');
    }

    // Check cache first
    const cacheKey = `agent:${agent.id}:requests`;

    const cached = await this.cacheManager.get<string>(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // extract names or codes depending on how your State entity stores value
    const states = agent.statesCovered;

    const deliveryRequests = await this.paginationProvider.paginateQuery(
      {
        page: deliveryRequestQuery.page || 1,
        limit: deliveryRequestQuery.limit || 10,
      },
      this.deliveryRequestRepo,
      {
        where: {
          state: In(states),
          status: RequestStatus.OPEN,
        },
        order: { createdAt: 'DESC' },
      },
    );

    // Store in cache for future requests
    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(deliveryRequests),
      CacheTTL.AgentOrders,
    );

    return deliveryRequests;
  }

  /**
   * Method to get detailed info about a specific delivery request
   */
  async getRequestInfo(requestId: number, userId: number) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId },
      relations: ['vendor', 'deliveries'],
    });

    if (!request) {
      throw new NotFoundException('Delivery request not found');
    }

    // Security check — ensure agent covers that request’s state
    if (!agent.statesCovered?.includes(request.state)) {
      throw new ForbiddenException(
        'You are not authorized to view this request',
      );
    }

    // Simplify vendor info (hide full profile)
    const vendor = {
      id: request.vendor.id,
      businessName: request.vendor.businessName,
    };

    return {
      id: request.id,
      title: request.title,
      description: request.description,
      state: request.state,
      status: request.status,
      vendor: vendor.businessName,
      deliveries: request.deliveries.map((delivery) => ({
        id: delivery.id,
        address: delivery.address,
        deliveryType: delivery.deliveryType,
      })),
    };
  }

  /**
   * Method to get Order Summary
   */
  async getOrderSummary(userId: number, requestId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId, vendor: { id: vendor.id } },
      relations: ['quotes.agent', 'deliveries', 'deliveries.deliveryCost'],
    });

    if (!request) throw new NotFoundException('Request not found');

    const acceptedQuote = request.quotes.find(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );
    if (!acceptedQuote) throw new BadRequestException('No accepted quote yet');

    return {
      requestId: request.id,
      deliveries: request.deliveries.map((d) => {
        return {
          address: d.address,
          cost: d.deliveryCost?.[0]?.cost ?? null, // deliveryCost array always has only 1 cost for this delivery from accepted quote
        };
      }),
      totalAmount: acceptedQuote.subtotal,
      agent: acceptedQuote.agent.businessName,
    };
  }
}
