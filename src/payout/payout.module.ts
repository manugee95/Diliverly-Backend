import { Module } from '@nestjs/common';
import { PayoutService } from './providers/payout.service';
import { User } from 'src/users/user.entity';
import { Transaction } from 'src/transactions/transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';
import { Agent } from 'src/agent/agent.entity';

@Module({
  providers: [PayoutService],
  imports: [
    TypeOrmModule.forFeature([User, Agent, Transaction]),
    TransactionsModule,
    ReferenceModule,
  ],
})
export class PayoutModule {}
