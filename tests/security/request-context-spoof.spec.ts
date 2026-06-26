import { describe, expect, it } from 'vitest';
import { RequestContextMiddleware } from '../../apps/api/src/request-context/request-context.middleware.js';
import { RequestContextService } from '../../apps/api/src/request-context/request-context.service.js';

describe('security: request context spoof resistance', () => {
  it('ignores client-supplied user, organization, and role headers', () => {
    const context = new RequestContextService();
    const middleware = new RequestContextMiddleware(context);
    const responseHeaders = new Map<string, string>();

    middleware.use(
      {
        headers: {
          'x-request-id': 'req_test_spoof',
          'x-user-id': crypto.randomUUID(),
          'x-organization-id': crypto.randomUUID(),
          'x-user-role': 'OWNER'
        }
      },
      {
        setHeader(name: string, value: string) {
          responseHeaders.set(name.toLowerCase(), value);
        }
      },
      () => {
        expect(context.getRequestId()).toBe('req_test_spoof');
        expect(context.getCurrentUser()).toBeUndefined();
        expect(context.getOrganizationId()).toBeUndefined();
      }
    );

    expect(responseHeaders.get('x-request-id')).toBe('req_test_spoof');
  });
});
