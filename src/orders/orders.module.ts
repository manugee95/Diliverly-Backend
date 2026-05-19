import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './providers/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/orderItem.entity';
import { Vendor } from '../vendor/vendor.entity';
import { DeliveryRequest } from '../delivery-requests/entities/delivery-request.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { PaginationModule } from '../common/pagination/pagination.module';
import { Transaction } from '../transactions/transaction.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { Agent } from '../agent/agent.entity';
import { EscrowModule } from '../escrow/escrow.module';
import { MailerModule } from '../mailer/mailer.module';
import { DashboardOverviewModule } from '../dashboard-overview/dashboard-overview.module';
import { OrdersCacheProvider } from './providers/orders.provider';
import { redisProvider } from '../common/providers/redis.provider';
import { CurrencyConvertProvider } from '../common/providers/currency-convert.provider';
import { OrderTimeExtension } from './entities/orderTimeExtension.entity';
import { OrderschedulerProvider } from './providers/orderscheduler.provider';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCacheProvider, redisProvider, CurrencyConvertProvider, OrderschedulerProvider],
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Vendor,
      DeliveryRequest,
      Agent,
      Transaction,
      OrderTimeExtension,
    ]),
    PaginationModule,
    TransactionsModule,
    EscrowModule,
    MailerModule,
    DashboardOverviewModule,
    CacheModule.register(),
  ],
})
export class OrdersModule {}
