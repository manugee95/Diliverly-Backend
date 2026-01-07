import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'The reference of the payment to verify',
    example: 'ref123456',
  })
  @IsString()
  reference: string;
}
