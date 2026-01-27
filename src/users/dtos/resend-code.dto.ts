import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendCodeDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
