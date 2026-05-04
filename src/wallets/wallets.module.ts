import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './providers/wallets.service';
import { Wallet } from './entities/wallet.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletFundingService } from './providers/wallet-funding.service';
import { PaystackModule } from '../paystack/paystack.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { User } from '../users/user.entity';
import { WalletFunding } from './entities/walletFunding.entity';
import { CurrencyConvertProvider } from '../common/providers/currency-convert.provider';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, WalletFundingService, CurrencyConvertProvider],
  imports: [
    TypeOrmModule.forFeature([Wallet, User, WalletFunding]),
    PaystackModule,
    TransactionsModule,
  ],
  exports: [WalletsService, WalletFundingService],
})
export class WalletsModule {}
