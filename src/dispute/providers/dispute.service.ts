import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryRequest } from '../../delivery-requests/entities/delivery-request.entity';
import { QuoteStatus } from '../../quotes/enums/quoteStatus.enum';
import { CreateDisputeDto } from '../dtos/createDispute.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Repository } from 'typeorm';
import { Vendor } from '../../vendor/vendor.entity';
import { Agent } from '../../agent/agent.entity';
import { OrderDispute } from '../entities/dispute.entity';
import { DisputeStatus } from '../enums/disputeStatus.enum';
import { OrderStatus } from '../../orders/enums/orderStatus.enum';
import { DisputeEvidence } from '../entities/disputeEvidence.entity';
import { DisputeMessage } from '../entities/disputeMessage.entity';
import { S3Service } from '../../s3/providers/s3.service';
import { GetDisputesDto } from '../dtos/getDisputes.dto';
import { User } from '../../users/user.entity';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';
import { GetDisputeMessagesDto } from '../dtos/getDisputeMessages.dto';

@Injectable()
export class DisputeService {
  constructor(
    /**
     * Inject Repositories
     */
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,

    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,

    @InjectRepository(OrderDispute)
    private readonly orderDisputeRepo: Repository<OrderDispute>,

    @InjectRepository(DisputeEvidence)
    private readonly disputeEvidenceRepo: Repository<DisputeEvidence>,

    @InjectRepository(DisputeMessage)
    private readonly disputeMessageRepo: Repository<DisputeMessage>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly s3Service: S3Service,

    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Method to open a dispute
   */
  async createDispute(
    userId: number,
    orderId: number,
    dto: CreateDisputeDto,
    file?: Express.Multer.File,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: [
        'vendor',
        'vendor.user',
        'request',
        'request.quotes',
        'request.quotes.agent',
        'request.quotes.agent.user',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Get accepted quote
    const acceptedQuote = order.request.quotes.find(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );

    if (!acceptedQuote) {
      throw new BadRequestException('No accepted quote found');
    }

    const assignedAgent = acceptedQuote.agent;

    // Determine actor
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    const isVendor = vendor && order.vendor.id === vendor.id;

    const isAgent = agent && assignedAgent.id === agent.id;

    if (!isVendor && !isAgent) {
      throw new ForbiddenException('You are not part of this order');
    }

    // Prevent multiple active disputes
    const existingDispute = await this.orderDisputeRepo.findOne({
      where: {
        order: { id: order.id },
        isResolved: false,
      },
    });

    if (existingDispute) {
      throw new BadRequestException('An active dispute already exists');
    }

    // Create dispute
    const dispute = new OrderDispute();

    dispute.order = order;
    dispute.openedByVendor = isVendor ? vendor : null;
    dispute.openedByAgent = isAgent ? agent : null;
    dispute.disputeType = dto.disputeType;
    dispute.reason = dto.reason;
    dispute.status = DisputeStatus.OPEN;

    const savedDispute = await this.orderDisputeRepo.save(dispute);

    // Upload evidence file
    if (file) {
      const uploaded = await this.s3Service.uploadFile(file);

      const evidence = new DisputeEvidence();

      evidence.dispute = savedDispute;
      evidence.fileUrl = uploaded;
      evidence.fileType = file.mimetype;
      evidence.uploadedBy = isVendor ? 'vendor' : 'agent';

      await this.disputeEvidenceRepo.save(evidence);
    }

    // Lock order
    order.status = OrderStatus.DISPUTE;

    await this.orderRepo.save(order);

    return {
      message: 'Dispute created successfully',
      dispute: savedDispute,
    };
  }

  /**
   * Method to send dispute messages between parties and admin mediation
   */
  async sendDisputeMessage(
    userId: number,
    disputeId: number,
    message: string,
    file?: Express.Multer.File,
  ) {
    const dispute = await this.orderDisputeRepo.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
    });

    let senderRole = 'admin';
    let senderId = userId;

    if (vendor) {
      senderRole = 'vendor';
      senderId = vendor.id;
    }

    if (agent) {
      senderRole = 'agent';
      senderId = agent.id;
    }

    const disputeMessage = new DisputeMessage();

    disputeMessage.dispute = dispute;
    disputeMessage.senderRole = senderRole;
    disputeMessage.senderId = senderId;
    disputeMessage.message = message;

    // Upload attachment
    if (file) {
      const uploaded = await this.s3Service.uploadFile(file);

      disputeMessage.attachmentUrl = uploaded;
      disputeMessage.attachmentType = file.mimetype;
    }

    return await this.disputeMessageRepo.save(disputeMessage);
  }

  /**
   * Method to get all disputes
   */

  //   async getAllDisputes(userId: number, disputesQuery: GetDisputesDto) {
  //     const user = await this.userRepo.findOne({
  //       where: { id: userId },
  //     });

  //     if (!user) {
  //       throw new BadRequestException('User not found');
  //     }

  //     const page = disputesQuery.page || 1;
  //     const limit = disputesQuery.limit || 10;

  //     const where: any = {};

  //     // Status filter
  //     if (disputesQuery.status) {
  //       where.status = disputesQuery.status;
  //     }

  //     /**
  //      * ADMIN
  //      * Can see all disputes
  //      */
  //     if (user.isAdmin) {
  //       // no additional filtering
  //     } else if (user.isVendor) {
  //       /**
  //        * VENDOR
  //        */
  //       const vendor = await this.vendorRepo.findOne({
  //         where: {
  //           user: { id: userId },
  //         },
  //       });

  //       if (!vendor) {
  //         throw new BadRequestException('Vendor not found');
  //       }

  //       where.order = {
  //         vendor: {
  //           id: vendor.id,
  //         },
  //       };
  //     } else if (user.isAgent) {
  //       /**
  //        * AGENT
  //        */
  //       const agent = await this.agentRepo.findOne({
  //         where: {
  //           user: { id: userId },
  //         },
  //       });

  //       if (!agent) {
  //         throw new BadRequestException('Agent not found');
  //       }

  //       where.openedByAgent = {
  //         id: agent.id,
  //       };
  //     } else {
  //       throw new ForbiddenException('Unauthorized access');
  //     }

  //     const disputes = await this.paginationProvider.paginateQuery(
  //       {
  //         page,
  //         limit,
  //       },
  //       this.orderDisputeRepo,
  //       {
  //         where,
  //         relations: [
  //           'order',
  //           'order.vendor',
  //           'order.vendor.user',
  //           'openedByVendor',
  //           'openedByAgent',
  //           'evidences',
  //         ],
  //         order: {
  //           createdAt: 'DESC',
  //         },
  //       },
  //     );

  //     return disputes;
  //   }

  async getAllDisputes(userId: number, disputesQuery: GetDisputesDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const page = disputesQuery.page || 1;
    const limit = disputesQuery.limit || 10;

    const query = this.orderDisputeRepo.createQueryBuilder('dispute');

    query
      .leftJoinAndSelect('dispute.order', 'order')
      .leftJoinAndSelect('order.vendor', 'vendor')
      .leftJoinAndSelect('vendor.user', 'vendorUser')
      .leftJoinAndSelect('order.request', 'request')
      .leftJoinAndSelect('request.quotes', 'quotes')
      .leftJoinAndSelect('quotes.agent', 'agent')
      .leftJoinAndSelect('agent.user', 'agentUser')
      .leftJoinAndSelect('dispute.openedByVendor', 'openedByVendor')
      .leftJoinAndSelect('dispute.openedByAgent', 'openedByAgent')
      .leftJoinAndSelect('dispute.evidences', 'evidences')
      .orderBy('dispute.createdAt', 'DESC');

    // Status filter
    if (disputesQuery.status) {
      query.andWhere('dispute.status = :status', {
        status: disputesQuery.status,
      });
    }

    /**
     * ADMIN
     */
    if (user.isAdmin) {
      // no restrictions
    } else if (user.isVendor) {

    /**
     * VENDOR
     */
      const vendor = await this.vendorRepo.findOne({
        where: {
          user: { id: userId },
        },
      });

      if (!vendor) {
        throw new BadRequestException('Vendor not found');
      }

      query.andWhere('vendor.id = :vendorId', {
        vendorId: vendor.id,
      });
    } else if (user.isAgent) {

    /**
     * AGENT
     */
      const agentProfile = await this.agentRepo.findOne({
        where: {
          user: { id: userId },
        },
      });

      if (!agentProfile) {
        throw new BadRequestException('Agent not found');
      }

      query.andWhere('quotes.status = :quoteStatus', {
        quoteStatus: QuoteStatus.ACCEPTED,
      });

      query.andWhere('agent.id = :agentId', {
        agentId: agentProfile.id,
      });
    } else {
      throw new ForbiddenException('Unauthorized access');
    }

    query.skip((page - 1) * limit);
    query.take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Method to get all messages for a dispute
   */
  async getDisputeMessages(
    userId: number,
    disputeId: number,
    query: GetDisputeMessagesDto,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const dispute = await this.orderDisputeRepo.findOne({
      where: { id: disputeId },
      relations: [
        'order',
        'order.vendor',
        'order.request',
        'order.request.quotes',
        'order.request.quotes.agent',
      ],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    /**
     * Vendor validation
     */
    if (user.isVendor) {
      const vendor = await this.vendorRepo.findOne({
        where: {
          user: { id: userId },
        },
      });

      if (!vendor || dispute.order.vendor.id !== vendor.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    /**
     * Agent validation
     */
    if (user.isAgent) {
      const agent = await this.agentRepo.findOne({
        where: {
          user: { id: userId },
        },
      });

      if (!agent) {
        throw new ForbiddenException('Access denied');
      }

      const acceptedQuote = dispute.order.request.quotes.find(
        (q) => q.status === QuoteStatus.ACCEPTED,
      );

      if (!acceptedQuote || acceptedQuote.agent.id !== agent.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const messages = await this.paginationProvider.paginateQuery(
      {
        page,
        limit,
      },
      this.disputeMessageRepo,
      {
        where: {
          dispute: {
            id: dispute.id,
          },
        },
        order: {
          createdAt: 'ASC',
        },
      },
    );

    return messages;
  }

  /**
   * Method for admin to resolve a dispute
   */
  async resolveDispute(adminId: number, disputeId: number, resolution: string) {
    const dispute = await this.orderDisputeRepo.findOne({
      where: { id: disputeId },
      relations: ['order'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.isResolved = true;
    dispute.resolution = resolution;
    dispute.resolvedByAdminId = adminId;

    await this.orderDisputeRepo.save(dispute);

    dispute.order.status = OrderStatus.ACTIVE;

    await this.orderRepo.save(dispute.order);

    return {
      message: 'Dispute resolved successfully',
    };
  }
}
