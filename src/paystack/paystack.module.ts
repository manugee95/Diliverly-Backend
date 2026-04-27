import { forwardRef, Module } from '@nestjs/common';
import { PaystackService } from './providers/paystack.service';
import { PaystackController } from './paystack.controller';
import { WalletsModule } from 'src/wallets/wallets.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  providers: [PaystackService],
  controllers: [PaystackController],
  imports: [
    forwardRef(() => WalletsModule),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  exports: [PaystackService],
})
export class PaystackModule {}
