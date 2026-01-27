import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/userRole.enum';
import {
  IsEnum,
  IsNotEmpty,
  IsEmail,
  MaxLength,
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsISO8601,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'role of the user',
    example: 'super_admin, admin, vendor, agent, moderator',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({
    description: 'user email address',
    example: 'johndoe@test.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(96)
  email: string;

  @ApiProperty({
    description: 'user password',
    example: 'P@ssw0rd123',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/
, {
    message:
      'Password must be atleast 8 characters with atleast one number, one character and one letter',
  })
  password: string;

  @ApiProperty({
    description: 'user first name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  @MinLength(3)
  firstName: string;

  @ApiProperty({
    description: 'user last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  @MinLength(3)
  lastName: string;

  @ApiProperty({
    description: 'user phone number',
    example: '+2348034567890',
  })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'user profile image url',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsISO8601()
  @IsOptional()
  createdAt?: Date;

  @IsISO8601()
  @IsOptional()
  updatedAt?: Date;
}
