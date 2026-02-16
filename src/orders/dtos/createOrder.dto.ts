import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from './createOrderItem.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'delivery request id for this order',
    example: 12,
  })
  @IsNumber()
  requestId: number;

  @ApiProperty({
    description: 'list of items in the order',
    example:
      '[{"itemName": "Wireless Mouse","quantity": 2,"buyerName": "John Doe","buyerPhone": "+1234567890"}]',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
