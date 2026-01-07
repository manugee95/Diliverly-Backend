import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'ID of the delivery request to initiate payment for',
    example: 5,
  })
  @IsNumber()
  requestId: number;
}
