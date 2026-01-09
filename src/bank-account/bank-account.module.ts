import { Module } from '@nestjs/common';
import { BankAccountController } from './bank-account.controller';
import { BankAccountService } from './providers/bank-account.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank_Account } from './bank-account.entity';
import { User } from 'src/users/user.entity';

@Module({
  controllers: [BankAccountController],
  providers: [BankAccountService],
  imports: [TypeOrmModule.forFeature([Bank_Account, User])],
})
export class BankAccountModule {}
