import { Module } from '@nestjs/common';
import { MailerController } from './mailer.controller';
import { MailerService } from './providers/mailer.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [MailerController],
  providers: [MailerService],
  imports: [ConfigModule],
  exports: [MailerService],
})
export class MailerModule {}
