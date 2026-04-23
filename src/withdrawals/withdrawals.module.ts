import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './providers/withdrawals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from './withdrawal.entity';
import { User } from 'src/users/user.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';
import { Agent } from 'src/agent/agent.entity';
import { MailerModule } from 'src/mailer/mailer.module';
import { CurrencyConvertProvider } from 'src/common/providers/currency-convert.provider';

@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, CurrencyConvertProvider],
  imports: [
    TypeOrmModule.forFeature([Withdrawal, Agent, User]),
    TransactionsModule,
    ReferenceModule,
    MailerModule
  ],
})
export class WithdrawalsModule {}
