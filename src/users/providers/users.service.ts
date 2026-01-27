import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import * as bcrypt from 'bcrypt';
import { User } from '../user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUsersDto } from '../dtos/get-users.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { UpdateUserDto } from '../dtos/patch-user.dto';
import { UserStatus } from '../enums/userStatus.enum';
import { MailerService } from 'src/mailer/providers/mailer.service';
import { VerifyEmailDto } from '../dtos/verify-email.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from 'src/common/providers/cache.service';
import { CacheTTL } from 'src/common/cache/cacheTTL';
import { DataSource } from 'typeorm';
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider';
import { UserRole } from '../enums/userRole.enum';
import { Vendor } from 'src/vendor/vendor.entity';
import { Response } from 'express';
import { Agent } from 'src/agent/agent.entity';

@Injectable()
export class UsersService {
  constructor(
    // Inject User Repository
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    //Inject Generate Tokens Provider
    private readonly generateTokensProvider: GenerateTokensProvider,

    /**
     * Injecting pagination provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,

    /**
     * Injecting Cache Service
     */
    @Inject(CACHE_MANAGER)
    private cacheManager: CacheService,

    /**
     * Injecting Data Source
     */
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Method to create a new user
   */
  public async createUser(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string }> {
    const { email, password, role, firstName } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Determine initial capabilities
    const isAgent = role === UserRole.AGENT;
    const isVendor = role === UserRole.VENDOR;

    // Store pending user data in cache (expires in 15 mins)
    await this.cacheManager.set(
      `pending_user:${email}`,
      {
        ...createUserDto,
        password: hashedPassword,
        verificationCode,
        isAgent,
        isVendor,
      },
      CacheTTL.UserSignup,
    );

    // Send verification email
    await this.mailService.sendTemplate(
      email,
      'Verify your email',
      'verify-email',
      {
        name: firstName,
        code: verificationCode,
      },
    );

    return { message: 'Verification code sent to your email.' };
  }

  /**
   * Method to verify user email
   */
  public async verifyEmail(
    dto: VerifyEmailDto,
    res: Response,
  ): Promise<{ message: string; accessToken: string }> {
    const { email, code } = dto;

    const pendingUser = await this.cacheManager.get<any>(
      `pending_user:${email}`,
    );

    if (!pendingUser) {
      throw new BadRequestException('Verification code expired or invalid');
    }

    if (pendingUser.verificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    let createdUser: User | undefined;

    await this.dataSource.transaction(async (manager) => {
      createdUser = manager.create(User, {
        email: pendingUser.email,
        password: pendingUser.password,
        firstName: pendingUser.firstName,
        lastName: pendingUser.lastName,
        phone: pendingUser.phone,
        profileImageUrl: pendingUser.profileImageUrl,
        isAgent: pendingUser.isAgent,
        isVendor: pendingUser.isVendor,
        status: UserStatus.ACTIVE,
      });

      await manager.save(createdUser);

      if (pendingUser.isAgent) {
        await manager.save(manager.create(Agent, { user: createdUser }));
      }

      if (pendingUser.isVendor) {
        await manager.save(manager.create(Vendor, { user: createdUser }));
      }
    });

    if (!createdUser) {
      throw new InternalServerErrorException('User creation failed');
    }

    // Generate tokens
    const tokens =
      await this.generateTokensProvider.generateTokens(createdUser);

    /// Save tokens in cookies
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

    await this.cacheManager.del(`pending_user:${email}`);

    // Send Welcome email
    await this.mailService.sendTemplate(
      email,
      'Welcome to Diliverly 🎉',
      'welcome',
      {
        name: createdUser.firstName,
        dashboardUrl: "https://google.com", // TODO: Update with actual dashboard URL
      },
    );

    return {
      message: 'Email verified successfully. Account created.',
      accessToken: tokens.accessToken,
    };
  }

  /**
   * The method to get a single user from DB
   */
  public async findOneById(id: number) {
    if (!id) {
      throw new BadRequestException('No user id provided');
    }

    let user: User | null;
    try {
      user = await this.userRepository.findOneBy({ id });
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment please try later',
        {
          description: 'Error connecting to the database',
        },
      );
    }

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  /**
   * Method to find user by email
   */
  public async findOneByEmail(email: string) {
    let user: User | null;

    try {
      user = await this.userRepository.findOneBy({
        email: email,
      });
    } catch (error) {
      throw new RequestTimeoutException(error, {
        description: 'Could not fetch user from DB',
      });
    }

    if (!user) {
      throw new UnauthorizedException('User does not exist');
    }

    return user;
  }

  /**
   * Method to find all users
   */
  public async findAll(
    userId: number,
    userQuery: GetUsersDto,
  ): Promise<Paginated<User> | User[]> {
    if (userId) {
      let user: User | null;
      try {
        user = await this.userRepository.findOne({
          where: { id: userId },
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new InternalServerErrorException('Failed to find user');
      }

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // If a specific user ID is provided, return that user
      return [user];
    }

    let users = await this.paginationProvider.paginateQuery(
      {
        page: userQuery.page || 1,
        limit: userQuery.limit || 10,
      },
      this.userRepository,
      {
        order: { createdAt: 'ASC' },
      },
    );

    // If no user ID is provided, return all users
    return users;
  }

  /**
   * Method to update a user
   */
  public async updateUser(userId: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, dto);

    return this.userRepository.save(user);
  }

  /**
   * Method to delete a user
   */
  public async deleteUser(id: number): Promise<{ message: string }> {
    try {
      const user = await this.findOneById(id);
      await this.userRepository.remove(user);
      return { message: 'User deleted successfully' };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
