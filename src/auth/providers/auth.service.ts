import { Injectable } from '@nestjs/common';
import { SignInProvider } from './sign-in.provider';
import { RefreshTokensProvider } from './refresh-tokens.provider';
import { SignInDto } from '../dtos/signin.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { ForgotPasswordProvider } from './forgot-password.provider';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { VerifyResetCodeDto } from '../dtos/verify-reset-code.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { ChangePasswordProvider } from './change-password.provider';
import { ChangePasswordDto } from '../dtos/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    /**
     * Injecting SignInProvider
     */
    private readonly signInProvider: SignInProvider,

    /**
     * Injecting RefreshTokensProvider
     */
    private readonly refreshTokensProvider: RefreshTokensProvider,

    /**
     * Injecting Forgot Password Provider
     */
    private readonly forgotPasswordProvider: ForgotPasswordProvider,

    /**
     * Injecting Change Password Provider
     */
    private readonly changePasswordProvider: ChangePasswordProvider,
  ) {}

  public async signin(signInDto: SignInDto) {
    return this.signInProvider.signin(signInDto);
  }

  // public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
  //   return this.refreshTokensProvider.refreshTokens(refreshTokenDto);
  // }

  public async forgotPassword(dto: ForgotPasswordDto) {
    return this.forgotPasswordProvider.forgotPassword(dto);
  }

  public async verifyResetCode(dto: VerifyResetCodeDto) {
    return this.forgotPasswordProvider.verifyResetCode(dto);
  }

  public async resetPassword(dto: ResetPasswordDto) {
    return this.forgotPasswordProvider.resetPassword(dto);
  }

  public async changePassword(userId: number, dto: ChangePasswordDto) {
    return this.changePasswordProvider.changePassword(userId, dto);
  }
}
