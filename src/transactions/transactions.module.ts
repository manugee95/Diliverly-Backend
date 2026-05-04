import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './providers/transactions.service';
import { Transaction } from './transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaginationModule } from '../common/pagination/pagination.module';
import { OrderItem } from '../orders/entities/orderItem.entity';
import { User } from '../users/user.entity';
import { TransactionsQueryService } from './providers/transactions-query.service';
import { CurrencyConvertProvider } from '../common/providers/currency-convert.provider';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsQueryService, CurrencyConvertProvider],
  imports: [
    TypeOrmModule.forFeature([Transaction, OrderItem, User]),
    PaginationModule,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
