import { Module } from '@nestjs/common';
import { EscrowService } from './providers/escrow.service';
import { Escrow } from './escrow.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsModule } from 'src/wallets/wallets.module';
import { TransactionsModule } from 'src/transactions/transactions.module';

@Module({
  providers: [EscrowService],
  imports: [
    TypeOrmModule.forFeature([Escrow]),
    WalletsModule,
    TransactionsModule,
  ],
  exports: [EscrowService],
})
export class EscrowModule {}
