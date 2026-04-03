import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailerService } from 'src/mailer/providers/mailer.service';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { VerifyResetCodeDto } from '../dtos/verify-reset-code.dto';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { generateVerificationCode } from 'src/common/utils/verification-code.util';

@Injectable()
export class ForgotPasswordProvider {
  constructor(
    /**
     * Inject User Repository
     */
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new BadRequestException('User not found');

    // Generate 6-digit reset code
    const resetCode = generateVerificationCode();

    user.resetCode = resetCode;
    user.resetCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await this.userRepo.save(user);

    // Send email

    await this.mailService.sendTemplate(
      email,
      'Verify your email',
      'forgot-password',
      {
        user: user.firstName,
        code: resetCode,
      },
    );

    return { message: 'Reset code sent to email.' };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    const { email, code } = dto;

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new BadRequestException('User not found');

    if (!user.resetCode) throw new BadRequestException('Reset code invalid');

    if (user.resetCode !== code)
      throw new BadRequestException('Incorrect reset code');

    // ensure resetCodeExpiresAt is defined before comparing
    if (!user.resetCodeExpiresAt || user.resetCodeExpiresAt < new Date())
      throw new BadRequestException('Reset code expired');

    return { message: 'Reset code verified.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, code, newPassword } = dto;

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new BadRequestException('User not found');

    if (!user.resetCode) throw new BadRequestException('Invalid reset code');

    if (user.resetCode !== code)
      throw new BadRequestException('Incorrect reset code');

    if (!user.resetCodeExpiresAt || user.resetCodeExpiresAt < new Date())
      throw new BadRequestException('Reset code expired');

    // hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await this.userRepo.save(user);

    return { message: 'Password has been reset successfully.' };
  }
}
