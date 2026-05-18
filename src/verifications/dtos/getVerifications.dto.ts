import { PartialType } from '@nestjs/mapped-types';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { VerificationStatus } from '../enums/verificationStatus.enum';

export class GetVerificationsDto extends PartialType(PaginationQueryDto) {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}