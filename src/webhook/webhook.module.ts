import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './providers/webhook.service';
import { WalletsModule } from '../wallets/wallets.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';
import { PaystackModule } from '../paystack/paystack.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
  imports: [
    WalletsModule,
    VirtualAccountModule,
    PaystackModule,
    WithdrawalsModule,
  ],
})
export class WebhookModule {}
