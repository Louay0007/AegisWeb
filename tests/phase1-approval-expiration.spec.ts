import { describe, expect, it } from 'vitest';
import { ApprovalStatus } from '@prisma/client';
import { ApprovalExpirationService } from '../apps/api/src/approvals/approval-expiration.service.js';

describe('ApprovalExpirationService.isExpired', () => {
  const service = Object.create(ApprovalExpirationService.prototype) as ApprovalExpirationService;

  it('marks pending approvals past expiresAt as expired', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');
    expect(
      service.isExpired(
        {
          status: ApprovalStatus.PENDING,
          expiresAt: new Date('2026-07-22T11:59:00.000Z')
        } as never,
        now
      )
    ).toBe(true);
  });

  it('keeps pending approvals without expiry as active', () => {
    expect(
      service.isExpired(
        {
          status: ApprovalStatus.PENDING,
          expiresAt: null
        } as never,
        new Date()
      )
    ).toBe(false);
  });

  it('does not treat already decided approvals as expired by time', () => {
    expect(
      service.isExpired(
        {
          status: ApprovalStatus.APPROVED,
          expiresAt: new Date('2020-01-01T00:00:00.000Z')
        } as never,
        new Date()
      )
    ).toBe(false);
  });
});
