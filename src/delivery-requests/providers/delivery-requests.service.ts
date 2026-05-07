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
import { Vendor } from '../../vendor/vendor.entity';
import { CreateDeliveryRequestDto } from '../dtos/create-delivery-request.dto';
import { RequestStatus } from '../enums/requestStatus.enum';
import { GetDeliveryRequestsDto } from '../dtos/get-delivery-requests.dto';
import { Paginated } from '../../common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';
import { QuoteStatus } from '../../quotes/enums/quoteStatus.enum';
import { Agent } from '../../agent/agent.entity';
import { MailerService } from '../../mailer/providers/mailer.service';
import { FavoriteAgent } from '../../favorites/favorite-agent.entity';
import { DashboardCacheProvider } from '../../dashboard-overview/providers/dashboard-overview.provider';
import { DeliveryRequestsCacheProvider } from './delivery-requests.provider';

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
     * Injecting FavoriteAgent repository
     */
    @InjectRepository(FavoriteAgent)
    private readonly favoriteAgentRepo: Repository<FavoriteAgent>,

    /**
     * Injecting Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,

    /**
     * Injecting Dashboard Cache Provider
     */
    private readonly dashboardCacheProvider: DashboardCacheProvider,

    /**
     * Injecting Delivery Requests Cache Provider
     */
    private readonly deliveryRequestCacheService: DeliveryRequestsCacheProvider,
  ) {}

  /**
   * Method to notify agent of new request
   */
  private async notifyAgent(payload: {
    agentEmail: string;
    agentName: string;
    vendorName: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.agentEmail,
        'New Delivery Request',
        'agent-delivery-request',
        {
          agentName: payload.agentName,
          vendorName: payload.vendorName,
          requestUrl: `${process.env.FRONTEND_URL}/agent/requests`,
        },
        `${payload.vendorName} just sent you a delivery request`,
      );
    } catch (error) {
      console.error('Failed to send agent email:', error);
    }
  }

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

    const { title, description, state, addresses, pickUpAddress } = dto;

    // Create the base request
    const deliveryRequest = this.deliveryRequestRepo.create({
      vendor,
      title,
      description,
      state,
      pickUpAddress,
      status: RequestStatus.OPEN,
      isDirect: false,
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

    await this.dashboardCacheProvider.invalidateVendor(vendor.id);

    await this.deliveryRequestCacheService.invalidateVendor(vendor.id);

    return savedRequest;
  }

  /**
   * Method to send an agent a delivery request directly
   */
  async sendDirectRequest(
    userId: number,
    agentId: number,
    dto: CreateDeliveryRequestDto,
  ) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
      relations: ['user'],
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Ensure agent is favorited
    const isFavorite = await this.favoriteAgentRepo.findOne({
      where: {
        vendor: { id: vendor.id },
        agent: { id: agent.id },
      },
    });

    if (!isFavorite) {
      throw new BadRequestException(
        'You can only send direct requests to favorited agents',
      );
    }

    // Validate coverage
    if (!agent.statesCovered?.includes(dto.state)) {
      throw new BadRequestException(
        'Agent does not cover the state for this delivery request',
      );
    }

    const { title, description, state, addresses, pickUpAddress } = dto;

    // Create DIRECT request
    const deliveryRequest = this.deliveryRequestRepo.create({
      vendor,
      title,
      description,
      state,
      pickUpAddress,
      status: RequestStatus.OPEN,
      isDirect: true,
      assignedAgent: agent,
    });

    const savedRequest = await this.deliveryRequestRepo.save(deliveryRequest);

    // Create deliveries
    const deliveries = addresses.map((address) =>
      this.deliveryRepo.create({
        request: savedRequest,
        address: address.address,
        deliveryType: address.deliveryType,
      }),
    );

    savedRequest.deliveries = deliveries;

    const finalRequest = await this.deliveryRequestRepo.save(savedRequest);

    // Notify agent
    await this.notifyAgent({
      agentEmail: agent.user.email,
      agentName: agent.businessName || 'Agent',
      vendorName: vendor.businessName || 'Vendor',
    });

    await this.dashboardCacheProvider.invalidateVendor(vendor.id);

    await this.deliveryRequestCacheService.invalidateAgent(agent.id);

    await this.deliveryRequestCacheService.invalidateVendor(vendor.id);

    await this.deliveryRequestCacheService.invalidateAgentAssignedRequests(
      agent.id,
    );

    return finalRequest;
  }

  /**
   * Method to get available delivery requests for an agent
   */
  private async buildAvailableRequestsForAgent(
    agent: Agent,
    deliveryRequestQuery: GetDeliveryRequestsDto,
  ): Promise<Paginated<DeliveryRequest>> {
    if (!agent?.statesCovered?.length) {
      throw new BadRequestException('No states covered by this agent');
    }

    const page = deliveryRequestQuery.page || 1;
    const limit = deliveryRequestQuery.limit || 10;

    const states = agent.statesCovered;

    return this.paginationProvider.paginateQuery(
      { page, limit },
      this.deliveryRequestRepo,
      {
        where: [
          {
            state: In(states),
            status: RequestStatus.OPEN,
            isDirect: false,
          },
          {
            state: In(states),
            status: RequestStatus.OPEN,
            isDirect: true,
            assignedAgent: { id: agent.id },
          },
        ],
        relations: ['vendor', 'assignedAgent', 'deliveries'],
        order: { createdAt: 'DESC' },
      },
    );
  }

  async getAvailableRequests(
    userId: number,
    deliveryRequestQuery: GetDeliveryRequestsDto,
  ) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const page = deliveryRequestQuery.page || 1;
    const limit = deliveryRequestQuery.limit || 10;

    const cached = await this.deliveryRequestCacheService.getRequests(
      agent.id,
      page,
      limit,
    );

    if (cached) return cached;

    const data = await this.buildAvailableRequestsForAgent(
      agent,
      deliveryRequestQuery,
    );

    await this.deliveryRequestCacheService.setRequests(
      agent.id,
      page,
      limit,
      data,
    );

    return data;
  }

  /**
   * Method to get detailed info about a specific delivery request
   */
  async getRequestInfo(
    requestId: number,
    userId: number,
    activeRole: 'agent' | 'vendor',
  ) {
    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId },
      relations: ['vendor', 'deliveries'],
    });
 
    if (!request) {
      throw new NotFoundException('Delivery request not found');
    }

    // AGENT VIEW
    if (activeRole === 'agent') {
      const agent = await this.agentRepo.findOne({
        where: { user: { id: userId } },
      });

      if (!agent) {
        throw new NotFoundException('Agent profile not found');
      }

      if (!agent.statesCovered?.includes(request.state)) {
        throw new ForbiddenException(
          'You are not authorized to view this request',
        );
      }
    }

    // VENDOR VIEW
    else if (activeRole === 'vendor') {
      const vendor = await this.vendorRepo.findOne({
        where: { user: { id: userId } },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor profile not found');
      }

      if (request.vendor.id !== vendor.id) {
        throw new ForbiddenException(
          'You are not authorized to view this request',
        );
      }
    }

    // Safety fallback
    else {
      throw new ForbiddenException('Invalid role context');
    }

    const vendorInfo = {
      id: request.vendor.id,
      businessName: request.vendor.businessName,
    };

    return {
      id: request.id,
      title: request.title,
      description: request.description,
      state: request.state,
      status: request.status,
      vendor: vendorInfo.businessName,
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

  /**
   * Method to get all delivery requests for a vendor with pagination and also filtering by status
   */
  private async buildVendorRequests(
    vendor: Vendor,
    deliveryRequestQuery: GetDeliveryRequestsDto,
  ): Promise<Paginated<DeliveryRequest>> {
    const page = deliveryRequestQuery.page || 1;
    const limit = deliveryRequestQuery.limit || 10;

    const where: any = {
      vendor: { id: vendor.id },
    };

    // Apply status filter if provided
    if (deliveryRequestQuery.status) {
      where.status = deliveryRequestQuery.status;
    }

    return this.paginationProvider.paginateQuery(
      { page, limit },
      this.deliveryRequestRepo,
      {
        where,
        order: { createdAt: 'DESC' },
      },
    );
  }

  async getVendorRequests(
    userId: number,
    deliveryRequestQuery: GetDeliveryRequestsDto,
  ): Promise<Paginated<DeliveryRequest>> {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const page = deliveryRequestQuery.page || 1;
    const limit = deliveryRequestQuery.limit || 10;
    const status = deliveryRequestQuery.status || 'all';

    const cached = await this.deliveryRequestCacheService.getVendorRequests(
      vendor.id,
      page,
      limit,
      status,
    );

    if (cached) return cached as Paginated<DeliveryRequest>;

    const data = await this.buildVendorRequests(vendor, deliveryRequestQuery);

    await this.deliveryRequestCacheService.setVendorRequests(
      vendor.id,
      page,
      limit,
      status,
      data,
    );

    return data;
  }

  /**
   * Method to cancel a delivery request - only if it's still open and not yet accepted by any agent
   */
  async cancelRequest(userId: number, requestId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId, vendor: { id: vendor.id } },
      relations: ['quotes', 'assignedAgent'],
    });

    if (!request) throw new NotFoundException('Request not found');

    if (request.status !== RequestStatus.OPEN) {
      throw new BadRequestException(
        'Only open requests can be cancelled. This request is already being processed.',
      );
    }

    request.status = RequestStatus.CANCELLED;

    const finalRequest = await this.deliveryRequestRepo.save(request);

    await this.deliveryRequestCacheService.invalidateAgentAssignedRequests(
      request.assignedAgent?.id,
    );

    // Notify assigned agent if it was a direct request
    // if (request.isDirect && request.assignedAgent) {
    //   await this.notifyAgent({
    //     agentEmail: request.assignedAgent.user.email,
    //     agentName: request.assignedAgent.businessName || 'Agent',
    //     request: finalRequest,
    //   });
    // }

    return finalRequest;
  }

  /**
   * Method to decline a direct request - only the assigned agent can decline and only if it's still open
   */
  async declineDirectRequest(userId: number, requestId: number) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const request = await this.deliveryRequestRepo.findOne({
      where: { id: requestId, assignedAgent: { id: agent.id } },
      relations: ['vendor'],
    });

    if (!request) throw new NotFoundException('Request not found');

    if (!request.isDirect) {
      throw new BadRequestException('Only direct requests can be declined');
    }

    if (request.status !== RequestStatus.OPEN) {
      throw new BadRequestException(
        'Only open requests can be declined. This request is already being processed.',
      );
    }

    request.status = RequestStatus.DECLINED;

    const finalRequest = await this.deliveryRequestRepo.save(request);

    await this.deliveryRequestCacheService.invalidateAgentAssignedRequests(
      agent.id,
    );

    // Notify vendor
    // await this.mailService.sendTemplate(
    //   request.vendor.user.email,
    //   'Your Direct Delivery Request Was Declined',
    //   'vendor-direct-request-declined',
    //   {
    //     vendorName: request.vendor.businessName || 'Vendor',
    //     agentName: agent.businessName || 'Agent',
    //     requestUrl: `${process.env.FRONTEND_URL}/vendor/requests`,
    //   },
    // );

    return finalRequest;
  }

  /**
   * Method to get all delivery requests assigned to an agent with pagination and also filtering by status
   */
  async getAgentAssignedRequests(
    userId: number,
    deliveryRequestQuery: GetDeliveryRequestsDto,
  ): Promise<Paginated<DeliveryRequest>> {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) {
      throw new BadRequestException('Agent not found');
    }

    const page = deliveryRequestQuery.page || 1;
    const limit = deliveryRequestQuery.limit || 10;

    // Try cache
    const cached =
      await this.deliveryRequestCacheService.getAgentAssignedRequests(
        agent.id,
        page,
        limit,
      );

    if (cached) return cached as Paginated<DeliveryRequest>;

    // Query DB
    const requests = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.deliveryRequestRepo,
      {
        where: {
          assignedAgent: { id: agent.id },
          status: RequestStatus.OPEN,
        },
        relations: ['vendor', 'deliveries'],
        order: { createdAt: 'DESC' },
      },
    );

    // Cache result
    await this.deliveryRequestCacheService.setAgentAssignedRequests(
      agent.id,
      page,
      limit,
      requests,
    );

    return requests;
  }
}
