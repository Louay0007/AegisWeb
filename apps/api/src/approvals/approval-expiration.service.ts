import { Injectable } from '@nestjs/common';
import { ApprovalRequest, ApprovalStatus } from '@prisma/client';

@Injectable()
export class ApprovalExpirationService {
  isExpired(approval: ApprovalRequest, now = new Date()): boolean {
    return approval.status === ApprovalStatus.PENDING && Boolean(approval.expiresAt && approval.expiresAt <= now);
  }
}
