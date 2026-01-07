import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './providers/withdrawals.service';
import { Type } from 'class-transformer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from './withdrawal.entity';
import { Agent } from 'src/agent/entities/agent.entity';
import { User } from 'src/users/user.entity';
import { Transaction } from 'src/transactions/transaction.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';

@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  imports: [
    TypeOrmModule.forFeature([Withdrawal, Agent, User]),
    TransactionsModule,
    ReferenceModule,
  ],
})
export class WithdrawalsModule {}
