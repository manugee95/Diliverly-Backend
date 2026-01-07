import { PartialType } from "@nestjs/mapped-types";
import { PaginationQueryDto } from "src/common/pagination/dtos/pagination-query.dto";

export class GetOrdersDto extends PartialType(PaginationQueryDto) {}