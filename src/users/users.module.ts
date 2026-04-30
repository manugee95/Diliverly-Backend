import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule),
    PaginationModule,
    MailerModule,
    S3Module,
  ],
  exports: [UsersService],
})
export class UsersModule {}
