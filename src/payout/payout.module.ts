import { Module } from '@nestjs/common';
import { PayoutService } from './providers/payout.service';
import { User } from 'src/users/user.entity';
import { Agent } from 'src/agent/entities/agent.entity';
import { Transaction } from 'src/transactions/transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';

@Module({
  providers: [PayoutService],
  imports: [
    TypeOrmModule.forFeature([User, Agent, Transaction]),
    TransactionsModule,
    ReferenceModule,
  ],
})
export class PayoutModule {}
