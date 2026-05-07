import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class MailerService {
  private resend: Resend;
  private from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
    this.from =
      this.configService.get('MAIL_FROM') ?? 'Dilivaly <no-reply@dilivaly.com>';
  }

  async sendTemplate(
    to: string,
    subject: string,
    template: string,
    data: Record<string, any>,
    preheader?: string,
  ) {
    const templatesPath = join(__dirname, 'templates');

    const layout = fs.readFileSync(join(templatesPath, 'layout.html'), 'utf8');

    const body = fs.readFileSync(
      join(templatesPath, `${template}.html`),
      'utf8',
    );

    const mergedLayout = layout.replace('{{body}}', body);

    const html = this.interpolate(mergedLayout, {
      ...data,
      subject,
      preheader,
      year: new Date().getFullYear(),
    });

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
