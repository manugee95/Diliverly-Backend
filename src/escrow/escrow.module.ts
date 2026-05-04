import { Module } from '@nestjs/common';
import { EscrowService } from './providers/escrow.service';
import { Escrow } from './escrow.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsModule } from '../wallets/wallets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CurrencyConvertProvider } from '../common/providers/currency-convert.provider';

@Module({
  providers: [EscrowService, CurrencyConvertProvider],
  imports: [
    TypeOrmModule.forFeature([Escrow]),
    WalletsModule,
    TransactionsModule,
  ],
  exports: [EscrowService],
})
export class EscrowModule {}
