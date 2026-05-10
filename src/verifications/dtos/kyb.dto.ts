import { IsString } from 'class-validator';

export class KybDto {
  @IsString()
  businessName!: string;

  @IsString()
  cacNumber!: string;

  @IsString()
  documentUrl!: string;
}
