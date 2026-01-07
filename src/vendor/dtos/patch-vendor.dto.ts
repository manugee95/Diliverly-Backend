import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateVendorDto } from './create-vendor.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @ApiProperty({
    description: 'first name of the vendor',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'last name of the vendor',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'profile image URL of the vendor',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}
