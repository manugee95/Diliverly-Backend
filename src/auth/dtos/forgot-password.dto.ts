import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'user verified email',
    example: 'johndoe@test.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
