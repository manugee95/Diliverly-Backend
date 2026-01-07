import {
  forwardRef,
  Inject,
  Injectable,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/providers/users.service';
import { HashingProvider } from './hashing.provider';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { SignInDto } from '../dtos/signin.dto';
import { UserStatus } from 'src/users/enums/userStatus.enum';
import { User } from 'src/users/user.entity';

@Injectable()
export class SignInProvider {
  constructor(
    /**
     * Injecting userService
     */
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,

    /**
     * Injecting hashingProvider
     */
    private readonly hashingProvider: HashingProvider,

    /**
     * Inject generateTokensProvider
     */
    private readonly generateTokensProvider: GenerateTokensProvider,
  ) {}

  // public async signin(signInDto: SignInDto) {
  //   const user = await this.userService.findOneByEmail(signInDto.email);

  //   if (!user) throw new UnauthorizedException('Invalid credentials');

  //   // Ensure account is active
  //   if (user.status === UserStatus.SUSPENDED) {
  //     throw new UnauthorizedException(
  //       'Your account has been suspended. Please contact support.',
  //     );
  //   } else if (user.status === UserStatus.BANNED) {
  //     throw new UnauthorizedException('Your account has been banned');
  //   } else if (user.status === UserStatus.IN_ACTIVE) {
  //     throw new UnauthorizedException(
  //       'Your account is not yet verified. Please verify your email to proceed.',
  //     );
  //   }

  //   const isEqual = await this.hashingProvider.comparePassword(
  //     signInDto.password,
  //     user.password,
  //   );

  //   if (!isEqual) {
  //     throw new UnauthorizedException('Password is incorrect');
  //   }

  //   return await this.generateTokensProvider.generateTokens(user);
  // }

  public async signin(signInDto: SignInDto): Promise<User> {
    const user = await this.userService.findOneByEmail(signInDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Account status checks
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Your account has been banned');
    }

    if (user.status === UserStatus.IN_ACTIVE) {
      throw new UnauthorizedException(
        'Your account is not yet verified. Please verify your email to proceed.',
      );
    }

    const isEqual = await this.hashingProvider.comparePassword(
      signInDto.password,
      user.password,
    );

    if (!isEqual) {
      throw new UnauthorizedException('Password is incorrect');
    }

    return user;
  }
}
