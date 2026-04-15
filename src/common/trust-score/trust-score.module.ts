import { Module } from '@nestjs/common';
import { TrustScoreProvider } from './trust-score.provider';

@Module({
  providers: [TrustScoreProvider],
  exports: [TrustScoreProvider],
})
export class TrustScoreModule {}
