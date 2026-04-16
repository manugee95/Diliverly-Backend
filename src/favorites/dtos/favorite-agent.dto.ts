import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class FavoriteAgentDto {
  @ApiProperty({
    description: 'The agent ID to add/remove from favorites',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  agentId: number;
}
