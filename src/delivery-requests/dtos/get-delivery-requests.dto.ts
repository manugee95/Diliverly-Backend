import { PartialType } from '@nestjs/mapped-types';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { RequestStatus } from "../enums/requestStatus.enum";
import { IsEnum, IsOptional } from 'class-validator';

export class GetDeliveryRequestsDto extends PartialType(PaginationQueryDto) {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
