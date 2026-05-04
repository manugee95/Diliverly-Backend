import { PartialType } from "@nestjs/mapped-types";
import { PaginationQueryDto } from "../../common/pagination/dtos/pagination-query.dto";

export class GetReviewsDto extends PartialType(PaginationQueryDto) {}