import { PaginationQueryDto } from "../../common/pagination/dtos/pagination-query.dto";
import { PartialType } from "@nestjs/mapped-types";

export class GetUsersDto extends PartialType(PaginationQueryDto) {}