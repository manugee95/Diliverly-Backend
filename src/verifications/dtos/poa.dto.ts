import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PoaDto {
  @ApiProperty({
    description: 'Registered business address',
    example: '123 Main Street, Lagos, Nigeria',
  })
  @IsString()
  address!: string;

  @ApiProperty({
    description: 'Meter or account number from the utility bill',
    example: '123456789',
  })
  @IsString()
  utility_number!: string;

  @ApiProperty({
    description: 'PrePaid or PostPaid',
    example: 'PrePaid',
  })
  @IsString()
  utility_type!: string;

  @ApiProperty({
    description: 'Utility provider name',
    example: 'IKEDC',
  })
  @IsString()
  utility_provider!: string;

  @ApiProperty({
    description: 'URL of the business document',
    example: 'https://example.com/document.pdf',
  })
  @IsOptional()
  @IsString()
  documentUrl?: string;
}
