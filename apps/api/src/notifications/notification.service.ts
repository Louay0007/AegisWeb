import { Inject, Injectable } from '@nestjs/common';
import { ApprovalRequest, UserRole, UserStatus } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { ApprovalEmailBuilder } from './approval-email.builder.js';
import { EmailNotificationAdapter } from './email-notification.adapter.js';
import {
  ApprovalNotificationContext,
  ApprovalNotificationResult,
  EmailAddress
} from './notifications.types.js';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ApprovalEmailBuilder) private readonly approvalEmailBuilder: ApprovalEmailBuilder,
    @Inject(EmailNotificationAdapter) private readonly emailAdapter: EmailNotificationAdapter
  ) {}

  async notifyApprovalRequested(approval: ApprovalRequest): Promise<ApprovalNotificationResult> {
    const context = await this.getApprovalContext(approval.id);
    const recipients = await this.getApprovalRecipients(context.organizationId);
    const dashboardUrl = this.approvalEmailBuilder.approvalUrl(context.id);

    if (recipients.length === 0) {
      return {
        channel: 'email',
        delivered: false,
        approvalRequestId: context.id,
        recipients: [],
        dashboardUrl,
        warning: 'No active owner or approver users were available for approval notification.'
      };
    }

    const email = this.approvalEmailBuilder.build({ approval: context, recipients });

    try {
      const result = await this.emailAdapter.send(email);
      return {
        channel: 'email',
        delivered: true,
        approvalRequestId: context.id,
        recipients: recipients.map((recipient) => recipient.email),
        subject: email.subject,
        messageId: result.messageId,
        dashboardUrl
      };
    } catch (error) {
      return {
        channel: 'email',
        delivered: false,
        approvalRequestId: context.id,
        recipients: recipients.map((recipient) => recipient.email),
        subject: email.subject,
        dashboardUrl,
        warning: error instanceof Error ? error.message : 'Approval notification failed.'
      };
    }
  }

  private async getApprovalContext(id: string): Promise<ApprovalNotificationContext> {
    const approval = await this.database.client.approvalRequest.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        workflowRunId: true,
        summary: true,
        riskLevel: true,
        amountCents: true,
        expiresAt: true,
        policyTriggeredJson: true,
        requestedByAgent: { select: { id: true, name: true, identifier: true } },
        workflowRun: {
          select: {
            workflow: { select: { id: true, name: true, template: true } },
            vendor: { select: { id: true, name: true, website: true } }
          }
        },
        actionAttempt: {
          select: {
            id: true,
            actionType: true,
            policyReason: true,
            inputSummary: true,
            amountCents: true
          }
        }
      }
    });

    if (!approval) {
      throw new DomainError(DomainErrorCode.NotFound, 'Approval request was not found.');
    }

    return approval;
  }

  private async getApprovalRecipients(organizationId: string): Promise<EmailAddress[]> {
    const users = await this.database.client.user.findMany({
      where: {
        organizationId,
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.OWNER, UserRole.APPROVER] }
      },
      select: {
        email: true,
        name: true,
        notificationPreference: {
          select: { approvalRequests: true }
        }
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }]
    });

    return users
      .filter((user) => user.notificationPreference?.approvalRequests !== false)
      .map((user) => ({
        email: user.email,
        name: user.name
      }));
  }
}
