import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './providers/webhook.service';
import { WalletsModule } from 'src/wallets/wallets.module';
import { VirtualAccountModule } from 'src/virtual-account/virtual-account.module';
import { PaystackModule } from 'src/paystack/paystack.module';
import { WithdrawalsModule } from 'src/withdrawals/withdrawals.module';

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
