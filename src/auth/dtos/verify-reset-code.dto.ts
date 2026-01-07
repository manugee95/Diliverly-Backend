import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({
    description: 'user verified email',
    example: 'johndoe@test.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'code sent to user email',
    example: '123456',
  })
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
