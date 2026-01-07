import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVendorDto {
  @ApiProperty({
    description: 'business name of the vendor',
    example: 'Acme Corp',
  })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({
    description: 'address of the vendor',
    example: '123 Main St, Lagos, Nigeria',
  })
  @IsOptional()
  @IsString()
  address?: string;
}
