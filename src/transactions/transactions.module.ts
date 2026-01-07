import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './providers/transactions.service';
import { Transaction } from './transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { User } from 'src/users/user.entity';
import { TransactionsQueryService } from './providers/transactions-query.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsQueryService],
  imports: [
    TypeOrmModule.forFeature([Transaction, OrderItem, User]),
    PaginationModule,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
