import { forwardRef, Module } from '@nestjs/common';
import { DeliveryRequestsController } from './delivery-requests.controller';
import { DeliveryRequestService } from './providers/delivery-requests.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryRequest } from './entities/delivery-request.entity';
import { Delivery } from './entities/delivery.entity';
import { VendorModule } from '../vendor/vendor.module';
import { Vendor } from '../vendor/vendor.entity';
import { AgentModule } from '../agent/agent.module';
import { PaginationModule } from '../common/pagination/pagination.module';
import { CacheModule } from '@nestjs/cache-manager';
import { Agent } from '../agent/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mailer/mailer.module';
import { FavoriteAgent } from '../favorites/favorite-agent.entity';
import { DashboardOverviewModule } from '../dashboard-overview/dashboard-overview.module';
import { DeliveryRequestsCacheProvider } from './providers/delivery-requests.provider';
import { redisProvider } from '../common/providers/redis.provider';

@Module({
  controllers: [DeliveryRequestsController],
  providers: [DeliveryRequestService, DeliveryRequestsCacheProvider, redisProvider],
  imports: [
    TypeOrmModule.forFeature([DeliveryRequest, Delivery, Vendor, Agent, FavoriteAgent]),
    forwardRef(() => AuthModule),
    VendorModule,
    AgentModule,
    PaginationModule,
    MailerModule,
    DashboardOverviewModule,
    CacheModule.register()
  ],
  exports: [DeliveryRequestService, DeliveryRequestsCacheProvider],
})
export class DeliveryRequestsModule {}
