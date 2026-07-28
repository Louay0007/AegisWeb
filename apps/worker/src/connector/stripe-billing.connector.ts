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
 * Browser connector for Stripe Dashboard billing surfaces.
 * Selectors are intentionally fail-closed: if Stripe changes markup, runs fail with VendorPageStructureChanged.
 */
@Injectable()
export class StripeBillingConnector implements VendorConnector {
  readonly connectorType = ConnectorType.StripeBilling;

  constructor(
    @Inject(WorkerPolicyClient) private readonly policy: WorkerPolicyClient,
    @Inject(ConnectorActionAttemptService) private readonly attempts: ConnectorActionAttemptService
  ) {}

  async login(context: ConnectorExecutionContext): Promise<void> {
    const loginUrl = new URL('/login', context.baseUrl).toString();
    await this.policy.evaluateAction({ actionType: ActionType.OpenPage, website: loginUrl });
    await context.browser.navigateWithPolicy(loginUrl);

    await requireVisible(context, 'input[type="email"], input[name="email"]', 'Stripe email field');
    await requireVisible(context, 'input[type="password"]', 'Stripe password field');

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
      inputSummary: 'Inject Stripe Dashboard login credentials.',
      metadataJson: {
        connector: 'StripeBillingConnector',
        username: context.credentials.username,
        hasTotpSecret: Boolean(context.credentials.totpSecret)
      }
    });

    await context.browser.page.locator('input[type="email"], input[name="email"]').first().fill(context.credentials.username);
    await context.browser.fillCredentialField('input[type="password"]', context.credentials.password);
    await context.browser.page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
    await context.browser.page.waitForLoadState('domcontentloaded');

    await completeTotpIfRequired(context, {
      connectorName: 'StripeBillingConnector',
      codeSelector: 'input[name*="code" i], input[autocomplete="one-time-code"], input[type="tel"]',
      submitSelector: 'button[type="submit"], button:has-text("Verify"), button:has-text("Continue")'
    });

    if (context.browser.page.url().includes('/login')) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Stripe Dashboard login failed.');
    }

    await this.attempts.complete(attempt.id, 'Stripe Dashboard credentials accepted.', {
      loginAccepted: true
    });
  }

  async downloadLatestInvoice(context: ConnectorExecutionContext): Promise<FileResult> {
    await this.openInvoices(context);
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
      inputSummary: 'Download latest Stripe invoice PDF.',
      metadataJson: { connector: 'StripeBillingConnector' }
    });

    const downloadSelector =
      'a[href*="invoice"], a:has-text("Download"), button:has-text("Download"), a[download]';
    await requireVisible(context, downloadSelector, 'Stripe invoice download control');
    const download = await context.browser.downloadWithCapture(downloadSelector, {
      actionType: ActionType.DownloadFile,
      label: 'stripe-latest-invoice',
      allowDownload: true
    });

    await this.attempts.complete(attempt.id, 'Latest Stripe invoice downloaded.', {
      path: download.path,
      sha256: download.sha256,
      sizeBytes: download.sizeBytes
    });

    return { ...download, kind: 'invoice' };
  }

  async readRenewalInfo(context: ConnectorExecutionContext): Promise<RenewalInfo> {
    await this.openSubscriptions(context);
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
      inputSummary: 'Extract Stripe subscription renewal data.',
      metadataJson: { connector: 'StripeBillingConnector' }
    });

    const body = (await context.browser.page.locator('body').textContent()) ?? '';
    const planMatch = body.match(/Plan[:\s]+([A-Za-z0-9 _-]+)/i);
    const amountMatch = body.match(/\$\s?([0-9]+(?:\.[0-9]{2})?)/);
    const renewalMatch = body.match(/Renew(?:al|s)?[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2}|[A-Za-z]+ \d{1,2}, \d{4})/i);
    const currentMonthlyPriceCents = centsFromText(amountMatch?.[1]);

    if (!planMatch && currentMonthlyPriceCents === 0) {
      throw new DomainError(
        DomainErrorCode.VendorPageStructureChanged,
        'Stripe subscription page did not expose recognizable plan/price fields.'
      );
    }

    const info: RenewalInfo = {
      vendorName: 'Stripe Billing',
      currentPlan: planMatch?.[1]?.trim() ?? 'Unknown',
      currentMonthlyPriceCents,
      renewalMonthlyPriceCents: currentMonthlyPriceCents,
      renewalDate: renewalMatch?.[1] ?? new Date().toISOString().slice(0, 10),
      seatCount: 1,
      unusedSeats: 0,
      estimatedMonthlySavingsCents: Math.max(0, Math.round(currentMonthlyPriceCents * 0.25)),
      recommendation: 'Review Stripe subscription plan for downgrade opportunity.'
    };

    await this.attempts.complete(attempt.id, 'Stripe renewal data extracted.', {
      renewalDate: info.renewalDate,
      renewalMonthlyPriceCents: info.renewalMonthlyPriceCents
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
      inputSummary: `Prepare Stripe plan downgrade from ${info.currentPlan}.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadataJson: {
        connector: 'StripeBillingConnector',
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
      summary: `Downgrade Stripe plan from ${info.currentPlan}.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadata: {
        vendorName: info.vendorName,
        currentPlan: info.currentPlan,
        targetPlan: readMetadataString(context.metadataJson, 'targetPlan') ?? 'Starter',
        renewalDate: info.renewalDate
      }
    };
  }

  async submitDowngrade(context: ConnectorExecutionContext): Promise<ActionResult> {
    if (!context.approvalToken) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'Approval token is required before submitting a Stripe downgrade.');
    }

    await this.openSubscriptions(context);
    const info = await this.readRenewalInfo(context);
    const policy = await this.policy.evaluateAction({
      actionType: ActionType.ChangePlan,
      website: context.browser.page.url(),
      approvalToken: context.approvalToken,
      amountCents: info.estimatedMonthlySavingsCents
    });

    if (policy.decision !== PolicyDecision.Allow) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'Stripe downgrade policy did not allow submission.');
    }

    const attempt = await this.attempts.record({
      workflowRunId: context.workflowRunId,
      website: context.browser.page.url(),
      actionType: ActionType.ChangePlan,
      riskLevel: policy.riskLevel,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      inputSummary: `Submit approved Stripe downgrade from ${info.currentPlan}.`,
      amountCents: info.estimatedMonthlySavingsCents,
      metadataJson: { connector: 'StripeBillingConnector', approvalTokenPresent: true }
    });

    const submitSelector =
      'button:has-text("Update plan"), button:has-text("Change plan"), button:has-text("Downgrade"), button:has-text("Confirm")';
    await requireVisible(context, submitSelector, 'Stripe plan change confirm control');
    await context.browser.clickWithActionAttempt(submitSelector, {
      actionType: ActionType.ChangePlan,
      label: 'stripe-submit-downgrade',
      sensitive: true
    });
    await context.browser.page.waitForLoadState('domcontentloaded');

    await this.attempts.complete(attempt.id, 'Approved Stripe downgrade submitted.', {});
    return {
      actionType: ActionType.ChangePlan,
      actionAttemptId: attempt.id,
      status: 'submitted',
      summary: 'Approved Stripe downgrade submitted.',
      metadata: { currentPlan: info.currentPlan }
    };
  }

  private async openInvoices(context: ConnectorExecutionContext): Promise<void> {
    const invoicesUrl = new URL('/invoices', context.baseUrl).toString();
    await context.browser.navigateWithPolicy(invoicesUrl);
    await requireVisible(context, 'main, [data-testid], table, a[href*="invoice"]', 'Stripe invoices page');
  }

  private async openSubscriptions(context: ConnectorExecutionContext): Promise<void> {
    const subscriptionsUrl = new URL('/subscriptions', context.baseUrl).toString();
    await context.browser.navigateWithPolicy(subscriptionsUrl);
    await requireVisible(context, 'main, [data-testid], table, body', 'Stripe subscriptions page');
  }
}
