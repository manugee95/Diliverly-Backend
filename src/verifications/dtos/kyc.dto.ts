import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class KycDto {
  @ApiProperty({
    description: 'Type of ID (e.g. NIN, VOTER_ID)',
    example: 'NIN',
  })
  @IsString()
  idType!: string;

  @ApiProperty({
    description: 'ID number',
    example: '12345678901',
  })
  @IsString()
  idNumber!: string;

  @ApiProperty({
    description: 'URL of the uploaded document',
    example: 'https://example.com/document.pdf',
  })
  @IsString()
  @IsOptional()
  documentUrl?: string;
}
