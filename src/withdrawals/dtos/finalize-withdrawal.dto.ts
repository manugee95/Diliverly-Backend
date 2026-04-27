import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FinalizeWithdrawalDto {
  @ApiProperty({
    description: 'Transfer code for the withdrawal',
    example: 'TRF_4tkdiasrhle60tqw',
  })
  @IsString()
  transferCode: string;

  @ApiProperty({
    description: 'One-Time Password for finalizing the withdrawal',
    example: '138566',
  })
  @IsString()
  otp: string;
}