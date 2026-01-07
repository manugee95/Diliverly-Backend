import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({
    description: 'business name of the agent',
    example: 'Acme Corp',
  })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({
    description: 'address of the agent',
    example: '123 Main St, Lagos, Nigeria',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'bio of the agent',
    example: 'Experienced delivery agent specializing in western region logistics.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'states covered by the agent',
    example: '["Lagos", "Ogun", "Oyo"]',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statesCovered?: string[];
}
