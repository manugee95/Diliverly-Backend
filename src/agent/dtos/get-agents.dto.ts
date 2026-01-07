import { PartialType } from "@nestjs/mapped-types";
import { PaginationQueryDto } from "src/common/pagination/dtos/pagination-query.dto";

export class GetAgentsDto extends PartialType(PaginationQueryDto) {}