import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { UsersService } from 'src/users/providers/users.service';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { ActiveUserData } from '../interfaces/active-user-data.interface';

@Injectable()
export class RefreshTokensProvider {
  constructor(
    /**
     * Inject jwt service
     */
    private readonly jwtService: JwtService,

    /**
     * Inject jwt configuration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    /**
     * Inject UsersService
     */
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,

    /**
     * Inject GenerateTokensProvider
     */
    private readonly generateTokensProvider: GenerateTokensProvider,
  ) {}

  public async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      // Extract role too
      const payload = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'id' | 'activeRole'>
      >(refreshToken, {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
      });

      const user = await this.userService.findOneById(payload.id);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Optional but STRONGLY recommended validation
      if (payload.activeRole === 'agent' && !user.isAgent) {
        throw new UnauthorizedException('Invalid role');
      }

      if (payload.activeRole === 'vendor' && !user.isVendor) {
        throw new UnauthorizedException('Invalid role');
      }

      // Preserve role when regenerating tokens
      return await this.generateTokensProvider.generateTokens(
        user,
        payload.activeRole,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
