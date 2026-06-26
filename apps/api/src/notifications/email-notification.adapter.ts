import { Inject, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import validator from 'validator';
import { ConfigService } from '../config/config.service.js';
import { EmailMessage, EmailSendResult } from './notifications.types.js';

@Injectable()
export class EmailNotificationAdapter {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (message.to.length === 0) {
      throw new Error('Email requires at least one recipient.');
    }

    this.assertSafeMessage(message);
    const transport = nodemailer.createTransport({
      host: this.config.config.mailHost,
      port: this.config.config.mailPort,
      secure: this.config.config.mailSecure,
      requireTLS: this.config.config.nodeEnv === 'production' || this.config.config.mailRequireTls,
      auth:
        this.config.config.mailUser && this.config.config.mailPassword
          ? {
              user: this.config.config.mailUser,
              pass: this.config.config.mailPassword
            }
          : undefined
    });
    const result = await transport.sendMail({
      from: message.from,
      to: message.to.map((recipient) => this.formatAddress(recipient)),
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    transport.close();

    return {
      messageId: result.messageId,
      recipientCount: message.to.length
    };
  }

  private formatAddress(recipient: { name?: string | null; email: string }): string {
    const email = this.safeEmail(recipient.email);
    return recipient.name ? `${this.safeDisplayName(recipient.name)} <${email}>` : email;
  }

  private safeFrom(address: string): string {
    assertNoHeaderBreaks(address, 'from');
    const match = /<([^>]+)>/.exec(address);
    this.safeEmail(match?.[1] ?? address);
    return address;
  }

  private safeEmail(email: string): string {
    assertNoHeaderBreaks(email, 'email');
    if (!validator.isEmail(email, { require_tld: false })) {
      throw new Error('Email address is invalid.');
    }
    return email;
  }

  private safeDisplayName(name: string): string {
    assertNoHeaderBreaks(name, 'display name');
    return `"${name.replaceAll('"', '\\"')}"`;
  }

  private assertSafeMessage(message: EmailMessage): void {
    this.safeFrom(message.from);
    assertNoHeaderBreaks(message.subject, 'subject');
    for (const recipient of message.to) {
      this.formatAddress(recipient);
    }
  }
}

function assertNoHeaderBreaks(value: string, field: string): void {
  if (/\r|\n/.test(value)) {
    throw new Error(`Email ${field} must not contain header line breaks.`);
  }
}
