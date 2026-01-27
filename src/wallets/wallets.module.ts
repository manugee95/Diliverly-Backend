import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './providers/wallets.service';
import { Wallet } from './entities/wallet.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService],
  imports: [TypeOrmModule.forFeature([Wallet])]
})
export class WalletsModule {}
