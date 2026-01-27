import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { Auth } from './decorators/auth.decorator';
import { AuthType } from './enums/auth-type.enum';
import { SignInDto } from './dtos/signin.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { VerifyResetCodeDto } from './dtos/verify-reset-code.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { GenerateTokensProvider } from './providers/generate-tokens.provider';
import { RefreshTokensProvider } from './providers/refresh-tokens.provider';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    /**
     * Injecting authsService
     */
    private readonly authsService: AuthService,

    /**
     * Inject generateTokensProvider
     */
    private readonly generateTokensProvider: GenerateTokensProvider,

    /**
     * Inject refreshTokensProvider
     */
    private readonly refreshTokensProvider: RefreshTokensProvider,
  ) {}

  @ApiOperation({
    summary: 'User log in',
  })
  @ApiResponse({
    status: 201,
    description: 'Token is issued and also saved in http only cookies',
  })
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @Auth(AuthType.None)
  public async login(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; accessToken: string }> {
    const user = await this.authsService.signin(signInDto);

    const tokens = await this.generateTokensProvider.generateTokens(user);

    // Save tokens in cookies
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: tokens.accessTokenTtl * 1000,
      path: '/',
      domain: process.env.CLIENT_DOMAIN,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: tokens.refreshTokenTtl * 1000,
      path: '/',
      domain: process.env.CLIENT_DOMAIN,
    });

    return {
      message: 'Login successful',
      accessToken: tokens.accessToken,
    };
  }

  @ApiOperation({
    summary: 'Refresh user tokens',
  })
  @ApiResponse({
    status: 201,
    description:
      'Refresh token is gotten from cookies and new tokens are issued',
  })
  @Post('refresh-tokens')
  @Auth(AuthType.None)
  public async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; refreshToken: string }> {
    const refreshToken = req.cookies?.refreshToken;

    const tokens = await this.refreshTokensProvider.refreshTokens(refreshToken);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: tokens.accessTokenTtl * 1000,
      path: '/',
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: tokens.refreshTokenTtl * 1000,
      path: '/',
    });

    return {
      message: 'Tokens refreshed successfully',
      refreshToken: tokens.refreshToken,
    };
  }

  @ApiOperation({
    summary: 'Initiate forgot password process',
  })
  @ApiResponse({
    status: 201,
    description: 'Reset code sent to email.',
  })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Auth(AuthType.None)
  public async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authsService.forgotPassword(dto);
  }

  @ApiOperation({
    summary: 'Verify reset code',
  })
  @ApiResponse({
    status: 201,
    description: 'Reset code verified successfully.',
  })
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @Auth(AuthType.None)
  public async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authsService.verifyResetCode(dto);
  }

  @ApiOperation({
    summary: 'Reset user password',
  })
  @ApiResponse({
    status: 201,
    description: 'Password reset successfully.',
  })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Auth(AuthType.None)
  public async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authsService.resetPassword(dto);
  }

  @ApiOperation({
    summary: 'Change user password',
  })
  @ApiResponse({
    status: 201,
    description: 'Password changed successfully.',
  })
  @Post('change-password')
  public async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    const userId = req.user.id;
    return this.authsService.changePassword(userId, dto);
  }
}
