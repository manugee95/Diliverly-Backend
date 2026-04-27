import { Module } from '@nestjs/common';
import { VirtualAccountController } from './virtual-account.controller';
import { VirtualAccountService } from './providers/virtual-account.service';
import { PaystackService } from 'src/paystack/providers/paystack.service';
import { PaystackModule } from 'src/paystack/paystack.module';

@Module({
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService],
  imports: [PaystackModule],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
