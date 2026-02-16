import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'email of the customer making the payment',
    example: 'customer@example.com',
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Amount to be paid in Naira',
    example: 5000,
  })
  @IsNumber()
  amountNaira: number;

  @ApiProperty({
    description: 'Your internal reference for the transaction',
    example: 'DELIVERY-REQ-12345',
  })
  @IsString()
  reference: string;

  @ApiProperty({
    description: 'Callback URL after payment (optional)',
    example: 'https://your-frontend/callback',  
  })
  @IsString()
  callback_url?: string;

  @ApiProperty({
    description: 'Additional metadata for the transaction (optional)',
    example: { deliveryRequestId: 5 },
  })
  metadata?: any;
}
