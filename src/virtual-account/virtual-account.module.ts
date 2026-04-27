import { Module } from '@nestjs/common';
import { VirtualAccountController } from './virtual-account.controller';
import { VirtualAccountService } from './providers/virtual-account.service';
import { PaystackModule } from 'src/paystack/paystack.module';
import { VirtualAccount } from './virtual-account.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService],
  imports: [TypeOrmModule.forFeature([VirtualAccount]), PaystackModule],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
