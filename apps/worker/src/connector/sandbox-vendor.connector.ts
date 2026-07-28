import { Inject, Injectable } from '@nestjs/common';
import { ActionType, ConnectorType, DomainError, DomainErrorCode, PolicyDecision } from '@agentpass/domain';
import { WorkerPolicyClient } from '../policy-client/worker-policy-client.service.js';
import { ConnectorActionAttemptService } from './connector-action-attempt.service.js';
import {
  ActionResult,
  ConnectorExecutionContext,
  FileResult,
  ProposedAction,
  RenewalInfo,
  VendorConnector
} from './vendor-connector.types.js';

@Injectable()
export class SandboxVendorConnector implements VendorConnector {
  readonly connectorType = ConnectorType.Sandbox;

  constructor(
    @Inject(WorkerPolicyClient) private readonly policy: WorkerPolicyClient,
    @Inject(ConnectorActionAttemptService) private readonly attempts: ConnectorActionAttemptService
  ) {}

  async login(context: ConnectorExecutionContext): Promise<void> {
    await this.policy.evaluateAction({
      actionType: ActionType.OpenPage,
      website: context.baseUrl
    });
    await context.browser.navigateWithPolicy(new URL('/login', context.baseUrl).toString());

    const credentialPolicy = await this.policy.evaluateAction({
      actionType: ActionType.CredentialInjection,
      website: context.browser.page.url()
    });
    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.CredentialInjection,
      riskLevel: credentialPolicy.riskLevel,
      policyDecision: credentialPolicy.decision,
      policyReason: credentialPolicy.reason,
      inputSummary: 'Inject sandbox login credentials.',
      metadataJson: {
        connector: 'SandboxVendorConnector',
        username: context.credentials.username
      }
    });

    await context.browser.page.locator('#email').fill(context.credentials.username);
    await context.browser.fillCredentialField('#password', context.credentials.password);
    await context.browser.clickWithActionAttempt('#login-submit', {
      actionType: ActionType.ClickButton,
      label: 'sandbox-login-submit'
    });
    await context.browser.page.waitForLoadState('domcontentloaded');

    const responseText = (await context.browser.page.locator('body').textContent()) ?? '';
    if (!responseText.includes('"ok":true')) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Sandbox login failed.');
    }

    await this.attempts.complete(attempt.id, 'Sandbox login credentials accepted.', {
      loginAccepted: true
    });
  }

  async downloadLatestInvoice(context: ConnectorExecutionContext): Promise<FileResult> {
    await this.ensureBillingPage(context);
    const policy = await this.policy.evaluateAction({
      actionType: ActionType.DownloadFile,
      website: context.browser.page.url()
    });
    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.DownloadFile,
      riskLevel: policy.riskLevel,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      inputSummary: 'Download latest Acme Analytics invoice.',
      metadataJson: {
        connector: 'SandboxVendorConnector',
        selector: '#download-latest-invoice'
      }
    });

    const download = await context.browser.downloadWithCapture('#download-latest-invoice', {
      actionType: ActionType.DownloadFile,
      label: 'acme-latest-invoice',
      allowDownload: true
    });

    await this.attempts.complete(attempt.id, 'Latest sandbox invoice downloaded.', {
      path: download.path,
      sha256: download.sha256,
      sizeBytes: download.sizeBytes
    });

    return {
      ...download,
      kind: 'invoice'
    };
  }

  async readRenewalInfo(context: ConnectorExecutionContext): Promise<RenewalInfo> {
    await this.ensureBillingPage(context);
    const policy = await this.policy.evaluateAction({
      actionType: ActionType.ReadPage,
      website: context.browser.page.url()
    });
    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.ReadPage,
      riskLevel: policy.riskLevel,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      inputSummary: 'Extract renewal data from sandbox billing page.',
      metadataJson: {
        connector: 'SandboxVendorConnector',
        selector: '#renewal-json'
      }
    });

    const raw = await context.browser.page.locator('#renewal-json').textContent();
    const info = parseRenewalInfo(raw ?? '{}');

    await this.attempts.complete(attempt.id, 'Sandbox renewal data extracted.', {
      renewalDate: info.renewalDate,
      renewalMonthlyPriceCents: info.renewalMonthlyPriceCents,
      unusedSeats: info.unusedSeats
    });

    return info;
  }

  async prepareDowngrade(context: ConnectorExecutionContext): Promise<ProposedAction> {
    const info = await this.readRenewalInfo(context);
    const policy = await this.policy.evaluateAction({
      actionType: ActionType.ChangePlan,
      website: context.browser.page.url(),
      amountCents: info.estimatedMonthlySavingsCents
    });
    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.ChangePlan,
      riskLevel: policy.riskLevel,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      inputSummary: `Prepare downgrade from ${info.currentPlan} to Starter.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadataJson: {
        connector: 'SandboxVendorConnector',
        currentPlan: info.currentPlan,
        targetPlan: 'Starter',
        approvalRequired: policy.decision === PolicyDecision.RequireApproval
      }
    });

    return {
      actionType: ActionType.ChangePlan,
      policyDecision: policy.decision,
      riskLevel: policy.riskLevel,
      approvalRequired: policy.decision === PolicyDecision.RequireApproval,
      actionAttemptId: attempt.id,
      summary: `Downgrade ${info.vendorName} from ${info.currentPlan} to Starter.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadata: {
        vendorName: info.vendorName,
        currentPlan: info.currentPlan,
        targetPlan: 'Starter',
        renewalDate: info.renewalDate
      }
    };
  }

  async submitDowngrade(context: ConnectorExecutionContext): Promise<ActionResult> {
    if (!context.approvalToken) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'Approval token is required before submitting a downgrade.');
    }

    await this.ensureBillingPage(context);
    const info = await this.readRenewalInfo(context);
    const policy = await this.policy.evaluateAction({
      actionType: ActionType.ChangePlan,
      website: context.browser.page.url(),
      approvalToken: context.approvalToken,
      amountCents: info.estimatedMonthlySavingsCents
    });

    if (policy.decision !== PolicyDecision.Allow) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'Downgrade policy did not allow submission.');
    }

    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.ChangePlan,
      riskLevel: policy.riskLevel,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      inputSummary: `Submit approved downgrade from ${info.currentPlan} to Starter.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadataJson: {
        connector: 'SandboxVendorConnector',
        approvalTokenPresent: true
      }
    });

    await context.browser.clickWithActionAttempt('#submit-downgrade', {
      actionType: ActionType.ChangePlan,
      label: 'submit-downgrade',
      sensitive: true
    });
    await context.browser.page.waitForLoadState('domcontentloaded');
    const responseText = (await context.browser.page.locator('body').textContent()) ?? '';

    await this.attempts.complete(attempt.id, 'Approved sandbox downgrade submitted.', {
      responseText
    });

    return {
      actionType: ActionType.ChangePlan,
      actionAttemptId: attempt.id,
      status: 'submitted',
      summary: 'Approved sandbox downgrade submitted.',
      metadata: {
        responseText
      }
    };
  }

  private async ensureBillingPage(context: ConnectorExecutionContext): Promise<void> {
    const currentUrl = context.browser.page.url();
    if (!currentUrl.includes('/billing')) {
      await context.browser.navigateWithPolicy(new URL('/billing', context.baseUrl).toString());
    }
  }
}

export function parseRenewalInfo(raw: string): RenewalInfo {
  const parsed = JSON.parse(raw) as Partial<RenewalInfo>;
  const required: Array<keyof RenewalInfo> = [
    'vendorName',
    'currentPlan',
    'currentMonthlyPriceCents',
    'renewalMonthlyPriceCents',
    'renewalDate',
    'seatCount',
    'unusedSeats',
    'estimatedMonthlySavingsCents',
    'recommendation'
  ];

  for (const key of required) {
    if (parsed[key] === undefined || parsed[key] === null) {
      throw new DomainError(DomainErrorCode.ValidationFailed, `Sandbox renewal data is missing ${key}.`);
    }
  }

  return parsed as RenewalInfo;
}
