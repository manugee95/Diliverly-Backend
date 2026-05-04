import { forwardRef, Module } from '@nestjs/common';
import { PaystackService } from './providers/paystack.service';
import { PaystackController } from './paystack.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { HttpModule } from '@nestjs/axios';
import { TransactionsModule } from '../transactions/transactions.module';
import { Transaction } from '../transactions/transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  providers: [PaystackService],
  controllers: [PaystackController],
  imports: [
    // forwardRef(() => WalletsModule),
    // HttpModule.register({
    //   timeout: 5000,
    //   maxRedirects: 5,
    // }),
    TypeOrmModule.forFeature([Transaction]),
    TransactionsModule
  ],
  exports: [PaystackService],
})
export class PaystackModule {}
