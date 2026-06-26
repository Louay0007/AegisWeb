import { describe, expect, it } from 'vitest';
import { EmailNotificationAdapter } from '../../apps/api/src/notifications/email-notification.adapter.js';

describe('security: email header injection prevention', () => {
  it('rejects CRLF in message headers before opening an SMTP connection', async () => {
    const adapter = new EmailNotificationAdapter({
      config: {
        mailHost: '127.0.0.1',
        mailPort: 1,
        mailSecure: false,
        mailRequireTls: false,
        nodeEnv: 'test'
      }
    } as never);

    await expect(
      adapter.send({
        from: 'AegisWeb <security@example.com>',
        to: [{ email: 'approver@example.com' }],
        subject: 'Approval requested\r\nBcc: attacker@example.com',
        text: 'text',
        html: '<p>text</p>'
      })
    ).rejects.toThrow(/line breaks/);
  });
});
