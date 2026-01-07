import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DeliveryType } from '../enums/deliveryType.enum';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DeliveryAddressDto {
  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;
}

export class CreateDeliveryRequestDto {
  @ApiProperty({
    description: 'title of the delivery request',
    example: 'I need to deliver some items from Lagos to Abuja',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'description of the delivery request',
    example:
      'This delivery request involves transporting fragile items that need careful handling.',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'state where the delivery will be made',
    example: 'Abuja',
  })
  @IsNotEmpty()
  @IsString()
  state: string;

  @ApiProperty({
    description: 'list of delivery addresses',
    example:
      '[{ address: "123 Main St, Lagos, Nigeria", deliveryType: "prepaid" }, { address: "456 Elm St, Abuja, Nigeria", deliveryType: "cod" }]',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryAddressDto)
  addresses: DeliveryAddressDto[];
}
