import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'delivery location id for this order',
    example: 12,
  })
  @IsNumber()
  deliveryId: number;

  @ApiProperty({
    description: 'name of the item to be delivered',
    example: 'Laptop',
  })
  @IsString()
  itemName: string;

  @ApiProperty({
    description: 'quantity of the item to be delivered',
    example: 2,
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'name of the buyer',
    example: 'John Doe',
  })
  @IsString()
  buyerName: string;

  @ApiProperty({
    description: 'phone number of the buyer',
    example: '+1234567890',
  })
  @IsString()
  buyerPhone: string;

  @ApiProperty({
    description: 'amount to be collected on delivery',
    example: '25000',
  })
  @IsOptional()
  @IsNumber()
  codAmount?: number;
}
