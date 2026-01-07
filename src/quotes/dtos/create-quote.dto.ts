import { IsNotEmpty, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class DeliveryCostDto {
  @IsNumber()
  deliveryId: number;

  @IsNumber()
  cost: number;
}

export class CreateQuoteDto {
  @ApiProperty({
    description: 'ID of the delivery request',
    example: 5,
  })
  @IsNotEmpty()
  requestId: number;

  @ApiProperty({
    description: 'List of delivery costs associated with the quote',
    example: '[{ deliveryId: 1, cost: 5000 }, { deliveryId: 2, cost: 7000 }]',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryCostDto)
  deliveryCosts: DeliveryCostDto[];
}
