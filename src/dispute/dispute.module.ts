import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './providers/dispute.service';
import { OrderDispute } from './entities/dispute.entity';
import { DisputeEvidence } from './entities/disputeEvidence.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Vendor } from '../vendor/vendor.entity';
import { Agent } from '../agent/agent.entity';
import { DisputeMessage } from './entities/disputeMessage.entity';
import { S3Module } from '../s3/s3.module';
import { User } from '../users/user.entity';
import { PaginationModule } from '../common/pagination/pagination.module';

@Module({
  controllers: [DisputeController],
  providers: [DisputeService],
  imports: [
    TypeOrmModule.forFeature([
      OrderDispute,
      DisputeEvidence,
      DisputeMessage,
      Order,
      Vendor,
      Agent,
      User,
    ]),
    S3Module,
    PaginationModule,
  ],
})
export class DisputeModule {}
