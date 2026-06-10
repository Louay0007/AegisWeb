import { Inject, Injectable } from '@nestjs/common';
import { isSecretFieldName } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { ApprovalNotificationContext, EmailAddress, EmailMessage } from './notifications.types.js';

type ApprovalEmailInput = {
  approval: ApprovalNotificationContext;
  recipients: EmailAddress[];
};

@Injectable()
export class ApprovalEmailBuilder {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  build(input: ApprovalEmailInput): EmailMessage {
    const approvalUrl = this.approvalUrl(input.approval.id);
    const vendor = input.approval.workflowRun.vendor?.name ?? 'Unknown vendor';
    const amount = input.approval.amountCents ?? input.approval.actionAttempt.amountCents;
    const matchedRules = this.extractMatchedRules(input.approval.policyTriggeredJson);
    const subject = `Approval required: ${input.approval.summary}`;
    const lines = [
      'AgentPass approval request',
      '',
      `Summary: ${input.approval.summary}`,
      `Workflow: ${input.approval.workflowRun.workflow.name}`,
      `Agent: ${input.approval.requestedByAgent.name} (${input.approval.requestedByAgent.identifier})`,
      `Vendor: ${vendor}`,
      `Action: ${this.domainLabel(input.approval.actionAttempt.actionType)}`,
      `Risk: ${this.domainLabel(input.approval.riskLevel)}`,
      `Amount: ${amount === null ? 'Not provided' : this.formatCents(amount)}`,
      `Policy reason: ${input.approval.actionAttempt.policyReason ?? 'Policy requires human approval.'}`,
      `Expires: ${input.approval.expiresAt?.toISOString() ?? 'No expiration set'}`,
      `Dashboard: ${approvalUrl}`
    ];

    if (matchedRules.length > 0) {
      lines.splice(lines.length - 1, 0, `Matched rules: ${matchedRules.join(', ')}`);
    }

    return {
      from: this.config.config.mailFrom,
      to: input.recipients,
      subject,
      text: lines.join('\n'),
      html: this.toHtml(lines),
    };
  }

  approvalUrl(approvalRequestId: string): string {
    return `${this.config.config.dashboardBaseUrl.replace(/\/$/, '')}/app/approvals/${approvalRequestId}`;
  }

  private extractMatchedRules(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }

    const object = value as Record<string, unknown>;
    if (Array.isArray(object.matchedRules)) {
      return object.matchedRules.filter((rule): rule is string => typeof rule === 'string' && !isSecretFieldName(rule));
    }

    return Object.entries(object)
      .filter(([key, entry]) => !isSecretFieldName(key) && typeof entry === 'string')
      .map(([key]) => key);
  }

  private formatCents(amountCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amountCents / 100);
  }

  private domainLabel(value: string): string {
    return value.toLowerCase().replaceAll('_', ' ');
  }

  private toHtml(lines: string): string;
  private toHtml(lines: string[]): string;
  private toHtml(lines: string | string[]): string {
    const entries = Array.isArray(lines) ? lines : lines.split('\n');
    return `<h1>AgentPass approval request</h1>${entries
      .slice(2)
      .map((line) => (line ? `<p>${this.escapeHtml(line)}</p>` : ''))
      .join('')}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
