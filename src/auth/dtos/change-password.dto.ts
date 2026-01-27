import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Length, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'old user password',
    example: 'OldPassw0rd!',
  })
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: 'new user password',
    example: 'NewPassw0rd!',
  })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/, {
    message:
      'Password must be atleast 8 characters with atleast one number, one character and one letter',
  })
  newPassword: string;
}
