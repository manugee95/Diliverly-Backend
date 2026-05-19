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

    private readonly s3Service: S3Service,
  ) {}

  /**
   * Method to open a dispute
   */

  //   async createDispute(userId: number, orderId: number, dto: CreateDisputeDto) {
  //     const order = await this.orderRepo.findOne({
  //       where: { id: orderId },
  //       relations: [
  //         'vendor',
  //         'vendor.user',
  //         'request',
  //         'request.quotes',
  //         'request.quotes.agent',
  //         'request.quotes.agent.user',
  //       ],
  //     });

  //     if (!order) {
  //       throw new NotFoundException('Order not found');
  //     }

  //     // Get accepted quote
  //     const acceptedQuote = order.request.quotes.find(
  //       (q) => q.status === QuoteStatus.ACCEPTED,
  //     );

  //     if (!acceptedQuote) {
  //       throw new BadRequestException('No accepted quote found');
  //     }

  //     const assignedAgent = acceptedQuote.agent;

  //     // Determine actor
  //     const vendor = await this.vendorRepo.findOne({
  //       where: { user: { id: userId } },
  //     });

  //     const agent = await this.agentRepo.findOne({
  //       where: { user: { id: userId } },
  //     });

  //     const isVendor = vendor && order.vendor.id === vendor.id;

  //     const isAgent = agent && assignedAgent.id === agent.id;

  //     if (!isVendor && !isAgent) {
  //       throw new ForbiddenException('You are not part of this order');
  //     }

  //     // Prevent multiple active disputes
  //     const existingDispute = await this.orderDisputeRepo.findOne({
  //       where: {
  //         order: { id: order.id },
  //         isResolved: false,
  //       },
  //     });

  //     if (existingDispute) {
  //       throw new BadRequestException('An active dispute already exists');
  //     }

  //     // Create dispute
  //     const dispute = new OrderDispute();
  //     dispute.order = order;
  //     dispute.openedByVendor = isVendor ? vendor : null;
  //     dispute.openedByAgent = isAgent ? agent : null;
  //     dispute.disputeType = dto.disputeType;
  //     dispute.reason = dto.reason;
  //     dispute.status = DisputeStatus.OPEN;

  //     const savedDispute = await this.orderDisputeRepo.save(dispute);

  //     // Save evidences
  //     if (dto.evidenceUrls?.length) {
  //       const evidences = dto.evidenceUrls.map((url) =>
  //         this.disputeEvidenceRepo.create({
  //           dispute: savedDispute,
  //           fileUrl: url,
  //           fileType: 'image',
  //           uploadedBy: isVendor ? 'vendor' : 'agent',
  //         }),
  //       );

  //       await this.disputeEvidenceRepo.save(evidences);
  //     }

  //     // Lock order
  //     order.status = OrderStatus.DISPUTE;

  //     await this.orderRepo.save(order);

  //     return {
  //       message: 'Dispute created successfully',
  //       dispute: savedDispute,
  //     };
  //   }

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

  //   async sendDisputeMessage(userId: number, disputeId: number, message: string) {
  //     const dispute = await this.orderDisputeRepo.findOne({
  //       where: { id: disputeId },
  //     });

  //     if (!dispute) {
  //       throw new NotFoundException('Dispute not found');
  //     }

  //     const vendor = await this.vendorRepo.findOne({
  //       where: { user: { id: userId } },
  //     });

  //     const agent = await this.agentRepo.findOne({
  //       where: { user: { id: userId } },
  //     });

  //     let senderRole = 'admin';
  //     let senderId = userId;

  //     if (vendor) {
  //       senderRole = 'vendor';
  //       senderId = vendor.id;
  //     }

  //     if (agent) {
  //       senderRole = 'agent';
  //       senderId = agent.id;
  //     }

  //     const disputeMessage = this.disputeMessageRepo.create({
  //       dispute,
  //       senderRole,
  //       senderId,
  //       message,
  //     });

  //     return await this.disputeMessageRepo.save(disputeMessage);
  //   }

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
