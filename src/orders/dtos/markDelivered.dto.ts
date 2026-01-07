import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class MarkDeliveredDto {
  @ApiProperty({
    description: 'ID of the order item to be marked as delivered',
    example: 5,
  })
  @IsNotEmpty()
  @IsNumber()
  orderItemId: number;

  @ApiProperty({
    description: 'Delivery pin provided to the delivery agent',
    example: '1234',
  })
  @IsNotEmpty()
  @IsString()
  deliveryPin: string;

  // only required for CoD
  @ApiProperty({
    description: 'Payment receipt URL for Cash on Delivery orders',
    example: 'https://example.com/receipt.jpg',
  })
  @IsOptional()
  @IsString()
  paymentReceiptUrl?: string;
}
