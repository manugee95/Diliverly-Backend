import { Module } from '@nestjs/common';
import { DashboardOverviewController } from './dashboard-overview.controller';
import { DashboardOverviewService } from './providers/dashboard-overview.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from 'src/vendor/vendor.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { Quote } from 'src/quotes/entities/quote.entity';
import { Order } from 'src/orders/entities/order.entity';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { DashboardCacheProvider } from './providers/dashboard-overview.provider';

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
    ]),
  ],
  exports: [DashboardOverviewService, DashboardCacheProvider],
})
export class DashboardOverviewModule {}
