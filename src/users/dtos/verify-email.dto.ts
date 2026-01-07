import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'user registered email',
    example: 'johndoe@test.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'verification code sent to user email',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  code: string;
}
