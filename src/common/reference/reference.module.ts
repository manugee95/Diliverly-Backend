import { Module } from '@nestjs/common';
import { ReferenceProvider } from './reference.provider';

@Module({
  providers: [ReferenceProvider],
  exports: [ReferenceProvider],
})
export class ReferenceModule {}
