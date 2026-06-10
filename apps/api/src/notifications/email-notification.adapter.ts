import { Inject, Injectable } from '@nestjs/common';
import { connect, Socket } from 'node:net';
import { ConfigService } from '../config/config.service.js';
import { EmailMessage, EmailSendResult } from './notifications.types.js';

@Injectable()
export class EmailNotificationAdapter {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (message.to.length === 0) {
      throw new Error('Email requires at least one recipient.');
    }

    const client = await SmtpSession.connect(this.config.config.mailHost, this.config.config.mailPort);
    try {
      await client.expect([220]);
      await client.command(`EHLO ${this.localHostname()}`, [250]);
      await client.command(`MAIL FROM:<${this.extractAddress(message.from)}>`, [250]);
      for (const recipient of message.to) {
        await client.command(`RCPT TO:<${recipient.email}>`, [250, 251]);
      }
      await client.command('DATA', [354]);
      await client.writeData(this.serializeMessage(message));
      await client.expect([250]);
      await client.command('QUIT', [221]);
    } finally {
      client.close();
    }

    return {
      messageId: this.messageId(),
      recipientCount: message.to.length
    };
  }

  private serializeMessage(message: EmailMessage): string {
    const boundary = `agentpass-${crypto.randomUUID()}`;
    const headers = [
      `From: ${message.from}`,
      `To: ${message.to.map((recipient) => this.formatAddress(recipient)).join(', ')}`,
      `Subject: ${this.foldHeader(message.subject)}`,
      `Message-ID: <${this.messageId()}@agentpass.local>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    ];

    return [
      ...headers,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.text,
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.html,
      `--${boundary}--`
    ]
      .join('\r\n')
      .replaceAll(/\r?\n\./g, '\r\n..');
  }

  private formatAddress(recipient: { name?: string | null; email: string }): string {
    return recipient.name ? `${this.quoteName(recipient.name)} <${recipient.email}>` : recipient.email;
  }

  private quoteName(name: string): string {
    return `"${name.replaceAll('"', '\\"')}"`;
  }

  private extractAddress(address: string): string {
    const match = /<([^>]+)>/.exec(address);
    return match?.[1] ?? address;
  }

  private foldHeader(value: string): string {
    return value.replaceAll(/\r?\n/g, ' ').slice(0, 240);
  }

  private messageId(): string {
    return crypto.randomUUID();
  }

  private localHostname(): string {
    return 'agentpass.local';
  }
}

class SmtpSession {
  private readonly pending: string[] = [];
  private buffered = '';

  private constructor(private readonly socket: Socket) {
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => this.buffer(chunk));
  }

  static connect(host: string, port: number): Promise<SmtpSession> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port });
      const onError = (error: Error) => {
        socket.destroy();
        reject(error);
      };

      socket.setTimeout(5000, () => {
        socket.destroy(new Error('SMTP connection timed out.'));
      });
      socket.once('error', onError);
      socket.once('connect', () => {
        socket.off('error', onError);
        resolve(new SmtpSession(socket));
      });
    });
  }

  command(command: string, expectedCodes: number[]): Promise<string> {
    this.socket.write(`${command}\r\n`);
    return this.expect(expectedCodes);
  }

  async writeData(data: string): Promise<void> {
    this.socket.write(`${data}\r\n.\r\n`);
  }

  expect(expectedCodes: number[]): Promise<string> {
    const existing = this.pending.shift();
    if (existing) {
      return this.assertCode(existing, expectedCodes);
    }

    return new Promise((resolve, reject) => {
      const onLine = () => {
        const line = this.pending.shift();
        if (!line) {
          return;
        }
        this.socket.off('error', onError);
        this.socket.off('close', onClose);
        this.assertCode(line, expectedCodes).then(resolve, reject);
      };
      const onError = (error: Error) => {
        this.socket.off('close', onClose);
        reject(error);
      };
      const onClose = () => {
        this.socket.off('error', onError);
        reject(new Error('SMTP connection closed unexpectedly.'));
      };

      this.socket.once('line', onLine);
      this.socket.once('error', onError);
      this.socket.once('close', onClose);
    });
  }

  close(): void {
    this.socket.end();
  }

  private buffer(chunk: string): void {
    this.buffered += chunk;
    while (this.buffered.includes('\n')) {
      const index = this.buffered.indexOf('\n');
      const line = this.buffered.slice(0, index).replace(/\r$/, '');
      this.buffered = this.buffered.slice(index + 1);
      if (/^\d{3} /.test(line)) {
        this.pending.push(line);
        this.socket.emit('line');
      }
    }
  }

  private async assertCode(line: string, expectedCodes: number[]): Promise<string> {
    const code = Number(line.slice(0, 3));
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP command failed: ${line}`);
    }

    return line;
  }
}
