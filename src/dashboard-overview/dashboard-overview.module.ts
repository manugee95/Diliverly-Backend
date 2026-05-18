import { Module } from '@nestjs/common';
import { DashboardOverviewController } from './dashboard-overview.controller';
import { DashboardOverviewService } from './providers/dashboard-overview.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from '../vendor/vendor.entity';
import { OrderItem } from '../orders/entities/orderItem.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Order } from '../orders/entities/order.entity';
import { DeliveryRequest } from '../delivery-requests/entities/delivery-request.entity';
import { DashboardCacheProvider } from './providers/dashboard-overview.provider';
import { Agent } from '../agent/agent.entity';

@Module({
  controllers: [DashboardOverviewController],
  providers: [DashboardOverviewService, DashboardCacheProvider],
  imports: [
    TypeOrmModule.forFeature([
      Vendor,
      DeliveryRequest,
      Order,
      Quote,
      OrderItem,
      Agent
    ]),
  ],
  exports: [DashboardOverviewService, DashboardCacheProvider],
})
export class DashboardOverviewModule {}
