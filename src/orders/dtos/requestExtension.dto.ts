import { IsNumber, IsString } from "class-validator";

export class RequestExtensionDto {
  @IsNumber()
  requestedHours!: number;

  @IsString()
  reason!: string;
}
