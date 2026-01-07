import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './providers/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/orderItem.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import { Payment } from 'src/payments/payment.entity';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { Agent } from 'src/agent/entities/agent.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { Transaction } from 'src/transactions/transaction.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Vendor,
      Payment,
      DeliveryRequest,
      Agent,
      Transaction,
    ]),
    PaginationModule,
    TransactionsModule,
    ReferenceModule,
    CacheModule.register(),
  ],
})
export class OrdersModule {}
