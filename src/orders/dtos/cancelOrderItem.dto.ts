import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class CancelOrderItemDto {
  @ApiProperty({
    description: 'ID of the order item to be cancelled',
    example: 5,
  })
  @IsNotEmpty()
  @IsNumber()
  orderItemId: number;
}
