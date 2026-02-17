import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './providers/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/orderItem.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { Transaction } from 'src/transactions/transaction.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';
import { Agent } from 'src/agent/agent.entity';
import { EscrowModule } from 'src/escrow/escrow.module';
import { MailerModule } from 'src/mailer/mailer.module';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Vendor,
      DeliveryRequest,
      Agent,
      Transaction,
    ]),
    PaginationModule,
    TransactionsModule,
    ReferenceModule,
    EscrowModule,
    MailerModule,
    CacheModule.register(),
  ],
})
export class OrdersModule {}
