import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';

export class VendorDecisionDto {
  @ApiProperty({
    description: 'ID of the order item',
    example: 5,
  })
  @IsNotEmpty()
  @IsNumber()
  orderItemId: number;

  @ApiProperty({
    description: 'Vendor approval decision for the COD order item',
    example: 'true for approve, false for decline',
  })
  @IsNotEmpty()
  @IsBoolean()
  approve: boolean; // true = approve, false = decline
}
