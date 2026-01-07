import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateAgentDto {
  @ApiProperty({
    description: 'rating for the agent between 1 and 5',
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'review for the agent',
    example: 'Excellent service provided by the agent.',
  })
  @IsOptional()
  @IsString()
  review?: string;
}
