import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './providers/withdrawals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from './withdrawal.entity';
import { User } from '../users/user.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { Agent } from '../agent/agent.entity';
import { MailerModule } from '../mailer/mailer.module';
import { CurrencyConvertProvider } from '../common/providers/currency-convert.provider';
import { PaystackModule } from '../paystack/paystack.module';

@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, CurrencyConvertProvider],
  imports: [
    TypeOrmModule.forFeature([Withdrawal, Agent, User]),
    TransactionsModule,
    MailerModule,
    PaystackModule,
  ],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
