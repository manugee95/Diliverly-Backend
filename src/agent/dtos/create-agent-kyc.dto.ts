import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateAgentKycDto {
  @IsOptional()
  @IsNumberString()
  nin?: string;

  @IsOptional()
  @IsNumberString()
  bvn?: string;

  @IsOptional()
  @IsString()
  selfieImageUrl?: string; 
}
