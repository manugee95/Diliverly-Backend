// import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';

// @Injectable()
// export class MailerService {
//   private transporter: nodemailer.Transporter;

//   constructor(private readonly configService: ConfigService) {
//     this.transporter = nodemailer.createTransport({
//       host: this.configService.get<string>('MAIL_HOST'),
//       port: this.configService.get<number>('MAIL_PORT'),
//       secure: true, // true for port 465, false for 587
//       auth: {
//         user: this.configService.get<string>('MAIL_USER'),
//         pass: this.configService.get<string>('MAIL_PASS'),
//       },
//     });
//   }

//   async sendMail({
//     to,
//     subject,
//     html,
//     text,
//   }: {
//     to: string;
//     subject: string;
//     html?: string;
//     text?: string;
//   }) {
//     try {
//       const from =
//         this.configService.get<string>('MAIL_FROM') ||
//         'Diliverly <no-reply@diliverly.com>';

//       await this.transporter.sendMail({
//         from,
//         to,
//         subject,
//         html,
//         text,
//       });

//       console.log(`Email sent to ${to} with subject "${subject}"`);
//     } catch (error) {
//       console.error('Error sending email:', error);
//       throw new InternalServerErrorException('Failed to send email');
//     }
//   }
// }

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private resend: Resend;
  private from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));

    this.from = this.configService.get<string>('MAIL_FROM') || 'no-reply@diliverly.com';
  }

  async sendMail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Resend error:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
