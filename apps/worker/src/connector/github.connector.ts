import { Inject, Injectable } from '@nestjs/common';
import {
  ActionType,
  ConnectorType,
  DomainError,
  DomainErrorCode,
  PolicyDecision
} from '@agentpass/domain';
import { WorkerPolicyClient } from '../policy-client/worker-policy-client.service.js';
import {
  centsFromText,
  completeTotpIfRequired,
  readMetadataString,
  requireVisible
} from './browser-connector.helpers.js';
import { ConnectorActionAttemptService } from './connector-action-attempt.service.js';
import {
  ActionResult,
  ConnectorExecutionContext,
  FileResult,
  ProposedAction,
  RenewalInfo,
  VendorConnector
} from './vendor-connector.types.js';

/**
 * Browser connector for GitHub billing surfaces (user or organization billing pages).
 * Fail-closed when expected login/billing controls are missing.
 */
@Injectable()
export class GitHubConnector implements VendorConnector {
  readonly connectorType = ConnectorType.Github;

  constructor(
    @Inject(WorkerPolicyClient) private readonly policy: WorkerPolicyClient,
    @Inject(ConnectorActionAttemptService) private readonly attempts: ConnectorActionAttemptService
  ) {}

  async login(context: ConnectorExecutionContext): Promise<void> {
    const loginUrl = new URL('/login', context.baseUrl).toString();
    await this.policy.evaluateAction({ actionType: ActionType.OpenPage, website: loginUrl });
    await context.browser.navigateWithPolicy(loginUrl);

    await requireVisible(context, '#login_field, input[name="login"]', 'GitHub username field');
    await requireVisible(context, '#password, input[name="password"]', 'GitHub password field');

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
      inputSummary: 'Inject GitHub login credentials.',
      metadataJson: {
        connector: 'GitHubConnector',
        username: context.credentials.username,
        hasTotpSecret: Boolean(context.credentials.totpSecret)
      }
    });

    await context.browser.page.locator('#login_field, input[name="login"]').first().fill(context.credentials.username);
    await context.browser.fillCredentialField('#password, input[name="password"]', context.credentials.password);
    await context.browser.page.locator('input[type="submit"], button[type="submit"]').first().click();
    await context.browser.page.waitForLoadState('domcontentloaded');

    await completeTotpIfRequired(context, {
      connectorName: 'GitHubConnector',
      codeSelector: '#app_totp, input[name="app_otp"], input[name="otp"], input[autocomplete="one-time-code"]',
      submitSelector: 'button[type="submit"], input[type="submit"]'
    });

    if (context.browser.page.url().includes('/login') || context.browser.page.url().includes('/sessions')) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'GitHub login failed or was blocked.');
    }

    await this.attempts.complete(attempt.id, 'GitHub credentials accepted.', { loginAccepted: true });
  }

  async downloadLatestInvoice(context: ConnectorExecutionContext): Promise<FileResult> {
    await this.openBilling(context);
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
      inputSummary: 'Download latest GitHub billing receipt/invoice.',
      metadataJson: { connector: 'GitHubConnector' }
    });

    const downloadSelector =
      'a[href*="receipt"], a[href*="invoice"], a:has-text("Download"), a:has-text("PDF"), a[download]';
    await requireVisible(context, downloadSelector, 'GitHub receipt download control');
    const download = await context.browser.downloadWithCapture(downloadSelector, {
      actionType: ActionType.DownloadFile,
      label: 'github-latest-invoice',
      allowDownload: true
    });

    await this.attempts.complete(attempt.id, 'Latest GitHub invoice downloaded.', {
      path: download.path,
      sha256: download.sha256,
      sizeBytes: download.sizeBytes
    });

    return { ...download, kind: 'invoice' };
  }

  async readRenewalInfo(context: ConnectorExecutionContext): Promise<RenewalInfo> {
    await this.openBilling(context);
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
      inputSummary: 'Extract GitHub plan/renewal data.',
      metadataJson: { connector: 'GitHubConnector' }
    });

    const body = (await context.browser.page.locator('body').textContent()) ?? '';
    const planMatch = body.match(/(Free|Team|Enterprise|Pro|Organization)[^\n]{0,40}/i);
    const amountMatch = body.match(/\$\s?([0-9]+(?:\.[0-9]{2})?)/);
    const seatsMatch = body.match(/(\d+)\s+seats?/i);
    const currentMonthlyPriceCents = centsFromText(amountMatch?.[1]);
    const seatCount = Number(seatsMatch?.[1] ?? 1);

    if (!planMatch && currentMonthlyPriceCents === 0) {
      throw new DomainError(
        DomainErrorCode.VendorPageStructureChanged,
        'GitHub billing page did not expose recognizable plan/price fields.'
      );
    }

    const info: RenewalInfo = {
      vendorName: 'GitHub',
      currentPlan: planMatch?.[1] ?? 'Unknown',
      currentMonthlyPriceCents,
      renewalMonthlyPriceCents: currentMonthlyPriceCents,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      seatCount,
      unusedSeats: 0,
      estimatedMonthlySavingsCents: Math.max(0, Math.round(currentMonthlyPriceCents * 0.2)),
      recommendation: 'Review GitHub seat usage before renewal.'
    };

    await this.attempts.complete(attempt.id, 'GitHub renewal data extracted.', {
      renewalDate: info.renewalDate,
      seatCount: info.seatCount
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
      inputSummary: `Prepare GitHub plan downgrade from ${info.currentPlan}.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadataJson: {
        connector: 'GitHubConnector',
        currentPlan: info.currentPlan,
        approvalRequired: policy.decision === PolicyDecision.RequireApproval
      }
    });

    return {
      actionType: ActionType.ChangePlan,
      policyDecision: policy.decision,
      riskLevel: policy.riskLevel,
      approvalRequired: policy.decision === PolicyDecision.RequireApproval,
      actionAttemptId: attempt.id,
      summary: `Downgrade GitHub plan from ${info.currentPlan}.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadata: {
        vendorName: info.vendorName,
        currentPlan: info.currentPlan,
        targetPlan: readMetadataString(context.metadataJson, 'targetPlan') ?? 'Free',
        renewalDate: info.renewalDate
      }
    };
  }

  async submitDowngrade(context: ConnectorExecutionContext): Promise<ActionResult> {
    if (!context.approvalToken) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'Approval token is required before submitting a GitHub downgrade.');
    }

    await this.openBilling(context);
    const info = await this.readRenewalInfo(context);
    const policy = await this.policy.evaluateAction({
      actionType: ActionType.ChangePlan,
      website: context.browser.page.url(),
      approvalToken: context.approvalToken,
      amountCents: info.estimatedMonthlySavingsCents
    });

    if (policy.decision !== PolicyDecision.Allow) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'GitHub downgrade policy did not allow submission.');
    }

    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.ChangePlan,
      riskLevel: policy.riskLevel,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      inputSummary: `Submit approved GitHub downgrade from ${info.currentPlan}.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadataJson: { connector: 'GitHubConnector', approvalTokenPresent: true }
    });

    const submitSelector =
      'button:has-text("Downgrade"), button:has-text("Change plan"), button:has-text("Confirm"), button:has-text("Update")';
    await requireVisible(context, submitSelector, 'GitHub plan change confirm control');
    await context.browser.clickWithActionAttempt(submitSelector, {
      actionType: ActionType.ChangePlan,
      label: 'github-submit-downgrade',
      sensitive: true
    });
    await context.browser.page.waitForLoadState('domcontentloaded');

    await this.attempts.complete(attempt.id, 'Approved GitHub downgrade submitted.', {});
    return {
      actionType: ActionType.ChangePlan,
      actionAttemptId: attempt.id,
      status: 'submitted',
      summary: 'Approved GitHub downgrade submitted.',
      metadata: { currentPlan: info.currentPlan }
    };
  }

  private async openBilling(context: ConnectorExecutionContext): Promise<void> {
    const org = readMetadataString(context.metadataJson, 'githubOrganization');
    const billingPath = org ? `/organizations/${org}/settings/billing` : '/settings/billing';
    const billingUrl = new URL(billingPath, context.baseUrl).toString();
    await context.browser.navigateWithPolicy(billingUrl);
    await requireVisible(context, 'main, .Layout-main, body', 'GitHub billing page');
  }
}
