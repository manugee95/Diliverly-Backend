import { forwardRef, Module } from '@nestjs/common';
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
import { AuthModule } from 'src/auth/auth.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { FavoriteAgent } from 'src/favorites/favorite-agent.entity';
import { DashboardOverviewModule } from 'src/dashboard-overview/dashboard-overview.module';
import { DeliveryRequestsCacheProvider } from './providers/delivery-requests.provider';
import { redisProvider } from 'src/common/providers/redis.provider';

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
