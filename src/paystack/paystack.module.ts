import { forwardRef, Module } from '@nestjs/common';
import { PaystackService } from './providers/paystack.service';
import { PaystackController } from './paystack.controller';
import { WalletsModule } from 'src/wallets/wallets.module';

@Module({
  providers: [PaystackService],
  controllers: [PaystackController],
  imports: [forwardRef(() => WalletsModule)],
  exports: [PaystackService],
})
export class PaystackModule {}
