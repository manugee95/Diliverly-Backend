import { PartialType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';

export class GetDisputeMessagesDto extends PartialType(PaginationQueryDto) {}