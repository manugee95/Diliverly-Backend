import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { AuthController } from './auth.controller';
import { BcryptProvider } from './providers/bcrypt.provider';
import { GenerateTokensProvider } from './providers/generate-tokens.provider';
import { HashingProvider } from './providers/hashing.provider';
import { RefreshTokensProvider } from './providers/refresh-tokens.provider';
import { SignInProvider } from './providers/sign-in.provider';
import { UsersModule } from 'src/users/users.module';
import jwtConfig from './config/jwt.config';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ForgotPasswordProvider } from './providers/forgot-password.provider';
import { ChangePasswordProvider } from './providers/change-password.provider';
import { User } from 'src/users/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from 'src/mailer/mailer.module';
import { AccessTokenGuard } from './guards/access-token/access-token.guard';
import { AuthenticationGuard } from './guards/authentication/authentication.guard';
import { AdminGuard } from './guards/roles/admin.guard';
import { VendorGuard } from './guards/roles/vendor.guard';
import { AgentGuard } from './guards/roles/agent.guard';

@Module({
  providers: [
    AuthService,
    {
      provide: HashingProvider,
      useClass: BcryptProvider,
    },
    GenerateTokensProvider,
    RefreshTokensProvider,
    SignInProvider,
    ForgotPasswordProvider,
    ChangePasswordProvider,
  ],
  controllers: [AuthController],
  imports: [
    forwardRef(() => UsersModule),
    TypeOrmModule.forFeature([User]),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    MailerModule,
  ],
  exports: [
    AuthService,
    HashingProvider,
    GenerateTokensProvider,
  ],
})
export class AuthModule {}
