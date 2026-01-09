import { Module } from '@nestjs/common';
import { DeliveryRequestsController } from './delivery-requests.controller';
import { DeliveryRequestService } from './providers/delivery-requests.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryRequest } from './entities/delivery-request.entity';
import { Delivery } from './entities/delivery.entity';
import { VendorModule } from 'src/vendor/vendor.module';
import { Vendor } from 'src/vendor/vendor.entity';
import { AgentModule } from 'src/agent/agent.module';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { CacheModule } from '@nestjs/cache-manager';
import { Agent } from 'src/agent/agent.entity';

@Module({
  controllers: [DeliveryRequestsController],
  providers: [DeliveryRequestService],
  imports: [
    TypeOrmModule.forFeature([DeliveryRequest, Delivery, Vendor, Agent]),
    VendorModule,
    AgentModule,
    PaginationModule,
    CacheModule.register()
  ],
})
export class DeliveryRequestsModule {}
