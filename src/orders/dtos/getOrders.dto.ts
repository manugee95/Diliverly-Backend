import { PartialType } from '@nestjs/mapped-types';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { OrderStatus } from '../enums/orderStatus.enum';
import { IsEnum, IsOptional } from 'class-validator';

export class GetOrdersDto extends PartialType(PaginationQueryDto) {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
