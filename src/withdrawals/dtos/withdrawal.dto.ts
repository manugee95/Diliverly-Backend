import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({
    description: 'amount to withdraw',
    example: '75000',
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
