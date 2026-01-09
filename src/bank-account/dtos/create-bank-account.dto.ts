import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty({
    description: 'Paystack Bank code of the bank to which the account belongs',
    example: '058',
  })
  @IsNotEmpty()
  @IsString()
  bankCode: string;

  @ApiProperty({
    description: 'Bank account number',
    example: '0121899311',
  })
  @IsNotEmpty()
  @IsString()
  accountNumber: string;
}
