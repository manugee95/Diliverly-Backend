import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAgentBankAccountDto {
  @IsNotEmpty()
  @IsString()
  bankCode: string;

  @IsNotEmpty()
  @IsString()
  accountNumber: string;
}
