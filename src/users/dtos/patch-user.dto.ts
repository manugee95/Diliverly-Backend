import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'user first name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  firstName?: string;

  @ApiProperty({
    description: 'user last name',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  lastName?: string;

  @ApiProperty({
    description: 'user phone number',
    example: '+2348034567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'user profile image url',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}
