import { Module } from '@nestjs/common';
import { VirtualAccountController } from './virtual-account.controller';
import { VirtualAccountService } from './providers/virtual-account.service';
import { PaystackModule } from '../paystack/paystack.module';
import { VirtualAccount } from './virtual-account.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';

@Module({
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService],
  imports: [TypeOrmModule.forFeature([VirtualAccount, User]), PaystackModule],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
