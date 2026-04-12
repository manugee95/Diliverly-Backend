import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { User } from 'src/users/user.entity';

@Injectable()
export class GenerateTokensProvider {
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
  ) {}

  public async signToken<T>(userId: number, expiresIn: number, payload?: T) {
    return await this.jwtService.signAsync(
      {
        id: userId,
        ...payload,
      },
      {
        audience: this.jwtConfiguration.audience,
        secret: this.jwtConfiguration.secret,
        issuer: this.jwtConfiguration.issuer,
        expiresIn,
      },
    );
  }

  // public async generateTokens(user: User) {
  //   const payload: Partial<ActiveUserData> = {
  //     email: user.email,
  //     isAgent: user.isAgent,
  //     isVendor: user.isVendor,
  //   };

  //   const [accessToken, refreshToken] = await Promise.all([
  //     // Access token
  //     this.signToken<Partial<ActiveUserData>>(
  //       user.id,
  //       this.jwtConfiguration.accessTokenTtl,
  //       payload,
  //     ),

  //     // Refresh token (minimal payload)
  //     this.signToken(user.id, this.jwtConfiguration.refreshTokenTtl),
  //   ]);

  //   return {
  //     accessToken,
  //     refreshToken,
  //     accessTokenTtl: this.jwtConfiguration.accessTokenTtl,
  //     refreshTokenTtl: this.jwtConfiguration.refreshTokenTtl,
  //   };
  // }

  public async generateTokens(user: User, activeRole?: 'agent' | 'vendor') {
    // Determine role (default or override)
    let role = activeRole;

    if (!role) {
      if (user.isAgent) role = 'agent';
      else if (user.isVendor) role = 'vendor';
      else throw new ForbiddenException('User has no valid role');
    }

    // Validate role ownership
    if (role === 'agent' && !user.isAgent) {
      throw new ForbiddenException('User is not an agent');
    }

    if (role === 'vendor' && !user.isVendor) {
      throw new ForbiddenException('User is not a vendor');
    }

    const payload: Partial<ActiveUserData> = {
      email: user.email,
      isAgent: user.isAgent,
      isVendor: user.isVendor,
      activeRole: role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      // Access token
      this.signToken<Partial<ActiveUserData>>(
        user.id,
        this.jwtConfiguration.accessTokenTtl,
        payload,
      ),

      // Refresh token SHOULD ALSO carry role
      this.signToken<Partial<ActiveUserData>>(
        user.id,
        this.jwtConfiguration.refreshTokenTtl,
        { activeRole: role },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenTtl: this.jwtConfiguration.accessTokenTtl,
      refreshTokenTtl: this.jwtConfiguration.refreshTokenTtl,
    };
  }
}
