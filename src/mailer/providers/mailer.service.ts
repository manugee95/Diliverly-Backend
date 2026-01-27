import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import { join } from 'path';

// @Injectable()
// export class MailerService {
//   private resend: Resend;
//   private from: string;

//   constructor(private readonly configService: ConfigService) {
//     this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));

//     this.from = this.configService.get<string>('MAIL_FROM') || 'no-reply@diliverly.com';
//   }

//   async sendMail({
//     to,
//     subject,
//     html,
//   }: {
//     to: string;
//     subject: string;
//     html: string;
//   }) {
//     try {
//       await this.resend.emails.send({
//         from: this.from,
//         to,
//         subject,
//         html,
//       });
//     } catch (error) {
//       console.error('Resend error:', error);
//       throw new InternalServerErrorException('Failed to send email');
//     }
//   }
// }

@Injectable()
export class MailerService {
  private resend: Resend;
  private from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
    this.from =
      this.configService.get('MAIL_FROM') ?? 'Diliverly <no-reply@diliverly.com>';
  }

  async sendTemplate(
    to: string,
    subject: string,
    template: string,
    data: Record<string, any>,
  ) {
    const layout = fs.readFileSync(
      join(__dirname, 'templates/layout.html'),
      'utf8',
    );

    const body = fs.readFileSync(
      join(__dirname, `templates/${template}.html`),
      'utf8',
    );

    const html = layout
      .replace('{{body}}', this.interpolate(body, data))
      .replace('{{subject}}', subject)
      .replace('{{year}}', new Date().getFullYear().toString());

    await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });
  }

  private interpolate(template: string, data: Record<string, any>) {
    return template.replace(/{{(\w+)}}/g, (_, key) => data[key] ?? '');
  }
}

