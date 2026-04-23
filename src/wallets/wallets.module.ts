import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './providers/wallets.service';
import { Wallet } from './entities/wallet.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletFundingService } from './providers/wallet-funding.service';
import { PaystackModule } from 'src/paystack/paystack.module';
import { ReferenceModule } from 'src/common/reference/reference.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { User } from 'src/users/user.entity';
import { WalletFunding } from './entities/walletFunding.entity';
import { CurrencyConvertProvider } from 'src/common/providers/currency-convert.provider';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, WalletFundingService, CurrencyConvertProvider],
  imports: [
    TypeOrmModule.forFeature([Wallet, User, WalletFunding]),
    PaystackModule,
    ReferenceModule,
    TransactionsModule,
  ],
  exports: [WalletsService, WalletFundingService],
})
export class WalletsModule {}
