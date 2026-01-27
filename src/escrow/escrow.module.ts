import { Module } from '@nestjs/common';
import { EscrowService } from './providers/escrow.service';

@Module({
  providers: [EscrowService]
})
export class EscrowModule {}
