import { Module } from '@nestjs/common';
import { VerificationsService } from './providers/verifications.service';
import { VerificationsController } from './verifications.controller';
import { SmileIdService } from './providers/smile-id.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Verification } from './verification.entity';
import { User } from '../users/user.entity';
import { S3Module } from '../s3/s3.module';

@Module({
  providers: [VerificationsService, SmileIdService],
  controllers: [VerificationsController],
  imports: [TypeOrmModule.forFeature([Verification, User]), S3Module],
})
export class VerificationsModule {}
