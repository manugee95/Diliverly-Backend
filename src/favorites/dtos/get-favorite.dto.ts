import { PartialType } from "@nestjs/swagger";
import { PaginationQueryDto } from "src/common/pagination/dtos/pagination-query.dto";

export class GetFavoritesDto extends PartialType(PaginationQueryDto) {}