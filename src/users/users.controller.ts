import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './providers/users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { GetUsersDto } from './dtos/get-users.dto';
import { UpdateUserDto } from './dtos/patch-user.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminGuard } from 'src/auth/guards/roles/admin.guard';
import { ResendCodeDto } from './dtos/resend-code.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(
    /**
     * Inject Users Service
     */
    private readonly usersService: UsersService,
  ) {}

  /**
   * Endpoint to create a new user
   */
  @ApiOperation({
    summary: 'Create a new user',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully.',
  })
  @Auth(AuthType.None)
  @Post()
  public createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  /**
   * Endpoint to resend signup verification code
   */
  @ApiOperation({
    summary: 'Resend signup verification code',
  })
  @ApiResponse({
    status: 200,
    description: 'User can resend a new code after 60 seconds.',
  })
  @Auth(AuthType.None)
  @Post('resend-signup-code')
  resendSignupCode(@Body() dto: ResendCodeDto) {
    return this.usersService.resendSignupVerificationCode(dto);
  }

  /**
   * Endpoint to verify email
   */
  @ApiOperation({
    summary: 'Verify user email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
  })
  @Auth(AuthType.None)
  @Post('verify-email')
  public verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.usersService.verifyEmail(dto, res);
  }

  /**
   * Endpoint to get a logged in user's profile
   */
  @ApiOperation({
    summary: 'Get logged in user profile',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully.',
  })
  @Get('/me')
  public getProfile(@Req() req) {
    return this.usersService.findOneById(req.user.id);
  }

  /**
   * endpoint to find all users or a single user by ID
   * If no ID is provided, it returns all users
   */
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Fetches a list of registered users on the application',
  })
  @ApiResponse({
    status: 200,
    description: 'Users fetched successfully based on the query',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'The User Id',
    example: 5,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'The number of entries returned per query',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'The page number returned per query',
    example: 1,
  })
  @Get('/{:id}')
  public async findAll(
    @Param('id') id: number,
    @Query() userQuery: GetUsersDto,
  ) {
    return this.usersService.findAll(id, userQuery);
  }

  /**
   * endpoint to update a user
   */
  @ApiOperation({
    summary: 'Update user profile',
  })
  @ApiResponse({
    status: 201,
    description: 'User profile updated successfully.',
  })
  @UseInterceptors(
    FileInterceptor('profileImage', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @Patch('/me')
  public updateProfile(
    @Req() req,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateUser(req.user.id, dto, file);
  }

  /**
   * endpoint to delete a user
   */
  @ApiOperation({
    summary: 'Delete a user',
  })
  @ApiResponse({
    status: 201,
    description: 'User deleted successfully.',
  })
  @UseGuards(AdminGuard)
  @Delete(':id')
  public async deleteUser(@Param('id') id: number) {
    return this.usersService.deleteUser(id);
  }
}
