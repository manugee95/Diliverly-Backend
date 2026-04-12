import { PartialType } from '@nestjs/mapped-types';
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto';
import { QuoteStatus } from "../enums/quoteStatus.enum";
import { IsEnum, IsOptional } from 'class-validator';

export class GetQuoteDto extends PartialType(PaginationQueryDto) {
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
