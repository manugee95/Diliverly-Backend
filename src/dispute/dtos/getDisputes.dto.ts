import { IsEnum, IsOptional } from 'class-validator';
import { DisputeStatus } from '../enums/disputeStatus.enum';
import { PartialType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';

export class GetDisputesDto extends PartialType(PaginationQueryDto) {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}
