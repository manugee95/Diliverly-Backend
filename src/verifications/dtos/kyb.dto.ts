import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class KybDto {
  @ApiProperty({
    description: 'Type of business (e.g., Sole Proprietorship, Partnership, Corporation)',
    example: 'co or bn',
  })
  @IsString()
  businessType!: string;

  @ApiProperty({
    description: 'Business name as registered with CAC',
    example: 'DILIVALY TECHNOLOGY LIMITED',
  })
  @IsString()
  businessName!: string;

  @ApiProperty({
    description: 'Type of ID (e.g., BUSINESS_REGISTRATION)',
    example: 'BUSINESS_REGISTRATION',
  })
  @IsString()
  idType!: string;

  @ApiProperty({
    description: 'CAC registration number',
    example: '12345678',
  })
  @IsString()
  idNumber!: string;

  @ApiProperty({
    description: 'URL of the business document',
    example: 'https://example.com/document.pdf',
  })
  @IsOptional()
  @IsString()
  documentUrl?: string;
}
