import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { DisputeType } from "../enums/disputeType.enum";


export class CreateDisputeDto {
  @IsEnum(DisputeType)
  disputeType!: DisputeType;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
