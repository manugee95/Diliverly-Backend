import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule),
    PaginationModule,
    MailerModule,
  ],
  exports: [UsersService],
})
export class UsersModule {}
