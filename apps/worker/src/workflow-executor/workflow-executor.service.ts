import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import {
  AgentStatus,
  ApprovalStatus,
  AuditEventType,
  FileKind,
  PolicyStatus,
  PolicyType,
  Prisma,
  ReceiptStatus,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowTemplate
} from '@prisma/client';
import { createControlledContext } from '@agentpass/browser-runtime';
import {
  ActionType,
  DomainError,
  DomainErrorCode,
  WorkflowQueueJobData
} from '@agentpass/domain';
import { WorkerAuditService } from '../audit/worker-audit.service.js';
import { SandboxVendorConnector } from '../connector/sandbox-vendor.connector.js';
import { RenewalInfo, VendorCredentials } from '../connector/vendor-connector.types.js';
import { WorkerDatabaseService } from '../database/worker-database.service.js';
import { InternalApiClient } from '../internal-api/internal-api-client.service.js';
import { WorkerLogger } from '../logging/worker-logger.service.js';
import { WorkerReceiptService, receiptStatusForRunStatus } from '../receipts/worker-receipt.service.js';
import { RunCancellationService } from './run-cancellation.service.js';
import { RunHeartbeatService } from './run-heartbeat.service.js';

export type WorkflowExecutionResult = {
  status: 'completed' | 'ignored' | 'skipped';
  workflowRunId: string;
  message: string;
};

type ExecutableRun = WorkflowRun & {
  workflow: { configurationJson: Prisma.JsonValue; template: WorkflowTemplate };
  vendor: { website: string } | null;
};

type PolicySnapshot = {
  allowedDomains: string[];
};

@Injectable()
export class WorkflowExecutorService {
  constructor(
    @Inject(WorkerDatabaseService) private readonly database: WorkerDatabaseService,
    @Inject(WorkerAuditService) private readonly audit: WorkerAuditService,
    @Inject(RunCancellationService) private readonly cancellation: RunCancellationService,
    @Inject(RunHeartbeatService) private readonly heartbeat: RunHeartbeatService,
    @Inject(SandboxVendorConnector) private readonly sandboxConnector: SandboxVendorConnector,
    @Inject(InternalApiClient) private readonly internalApi: InternalApiClient,
    @Inject(WorkerReceiptService) private readonly receipts: WorkerReceiptService,
    @Inject(WorkerLogger) private readonly logger: WorkerLogger
  ) {}

  async execute(data: WorkflowQueueJobData, jobId: string): Promise<WorkflowExecutionResult> {
    this.internalApi.setRunToken(data.workerRunToken);
    try {
      if (data.mode === 'resume') {
        return this.executeResume(data, jobId);
      }

      if (data.mode !== 'start') {
        return {
          status: 'skipped',
          workflowRunId: data.workflowRunId,
          message: `Worker skips ${data.mode} jobs until resume/cancel executors are implemented.`
        };
      }

      if (data.template === 'noop') {
        return this.executeNoop(data, jobId);
      }

      if (data.template === WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD) {
        return this.executeInvoiceDownload(data, jobId);
      }

      if (data.template === WorkflowTemplate.SAAS_RENEWAL_CHECK) {
        return this.executeRenewalCheck(data, jobId);
      }

      if (data.template === WorkflowTemplate.PLAN_DOWNGRADE_REQUEST) {
        return this.executePlanDowngradeStart(data, jobId);
      }

      return {
        status: 'skipped',
        workflowRunId: data.workflowRunId,
        message: `Worker does not yet execute ${data.template ?? 'unknown'} workflow jobs.`
      };
    } finally {
      this.internalApi.clearRunToken();
    }
  }

  private async executeInvoiceDownload(data: WorkflowQueueJobData, jobId: string): Promise<WorkflowExecutionResult> {
    const run = await this.findExecutableRun(data.workflowRunId, data.organizationId);
    if (!run) {
      return {
        status: 'ignored',
        workflowRunId: data.workflowRunId,
        message: 'Workflow run is missing or no longer executable.'
      };
    }

    const artifactDir = await mkdtemp(join(tmpdir(), `agentpass-run-${run.id}-`));
    let browser: Awaited<ReturnType<typeof createControlledContext>> | null = null;

    try {
      const running = await this.markStarted(run, jobId, 'invoice_download_started');
      await this.heartbeat.heartbeat(running.id, jobId);

      if (await this.cancellation.isCanceled(running.id)) {
        return {
          status: 'ignored',
          workflowRunId: running.id,
          message: 'Workflow run was canceled during execution.'
        };
      }

      const policy = await this.loadPolicySnapshot(running.organizationId, running.agentId);
      const baseUrl = this.requireVendorUrl(run);
      this.assertPolicyAllowsDomain(baseUrl, policy.allowedDomains);

      const credentialId = this.requireCredentialId(run.workflow.configurationJson);
      const credentials = await this.decryptCredentials(credentialId, running.id);
      browser = await createControlledContext({
        workflowRunId: running.id,
        organizationId: running.organizationId,
        allowedDomains: policy.allowedDomains,
        artifactDir,
        timeoutMs: 10000,
        headless: true,
        allowPrivateNetwork: process.env.NODE_ENV !== 'production'
      });

      await this.internalApi.recordRunEvent(running.id, {
        organizationId: running.organizationId,
        eventType: AuditEventType.POLICY_EVALUATED,
        eventDataJson: {
          actionType: ActionType.OpenPage,
          decision: 'allow',
          allowedDomains: policy.allowedDomains
        }
      });

      const context = {
        workflowRunId: running.id,
        organizationId: running.organizationId,
        agentId: running.agentId,
        vendorId: running.vendorId,
        baseUrl,
        browser,
        credentials
      };

      await this.sandboxConnector.login(context);
      const invoice = await this.sandboxConnector.downloadLatestInvoice(context);
      await this.uploadInvoice(running, invoice.path, invoice.suggestedFilename);

      const screenshot = await browser.captureScreenshot('invoice-download-complete');
      await this.uploadScreenshot(running, screenshot.path);

      await this.internalApi.recordRunEvent(running.id, {
        organizationId: running.organizationId,
        eventType: AuditEventType.FILE_DOWNLOADED,
        eventDataJson: {
          workflowRunId: running.id,
          filename: invoice.suggestedFilename,
          sha256: invoice.sha256,
          sizeBytes: invoice.sizeBytes
        }
      });

      await this.internalApi.completeRun(running.id, {
        organizationId: running.organizationId,
        currentStep: 'invoice_download_completed',
        resultSummary: `Downloaded latest invoice ${invoice.suggestedFilename}.`,
        stateJson: {
          jobId,
          invoiceFilename: invoice.suggestedFilename,
          invoiceSha256: invoice.sha256
        }
      });
      await this.receipts.createForRun({
        workflowRunId: running.id,
        finalStatus: ReceiptStatus.COMPLETED,
        summary: `Invoice download completed for workflow run ${running.id}.`
      });

      this.logger.info('Completed invoice download workflow job.', { workflowRunId: running.id, jobId });
      return {
        status: 'completed',
        workflowRunId: running.id,
        message: 'Invoice download workflow completed.'
      };
    } catch (error) {
      return this.handleInvoiceFailure(run, error);
    } finally {
      if (browser) {
        await browser.closeContext();
      }
      await rm(artifactDir, { recursive: true, force: true });
    }
  }

  private async handleInvoiceFailure(run: ExecutableRun, error: unknown): Promise<WorkflowExecutionResult> {
    const message = error instanceof Error ? error.message : 'Unknown invoice workflow error.';

    if (isPolicyDenial(error)) {
      const denied = await this.database.client.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.DENIED,
          completedAt: new Date(),
          currentStep: 'policy_denied',
          errorMessage: message,
          stateJson: this.nextState(run.stateJson, {
            status: WorkflowRunStatus.DENIED,
            reason: message,
            at: new Date().toISOString()
          })
        }
      });

      await this.audit.record({
        organizationId: denied.organizationId,
        workflowRunId: denied.id,
        agentId: denied.agentId,
        eventType: AuditEventType.WORKFLOW_RUN_DENIED,
        eventDataJson: {
          workflowRunId: denied.id,
          workflowId: denied.workflowId,
          reason: message
        }
      });
      await this.receipts.createForRun({
        workflowRunId: denied.id,
        finalStatus: ReceiptStatus.DENIED,
        summary: `Invoice download denied: ${message}`
      });

      return {
        status: 'completed',
        workflowRunId: denied.id,
        message: 'Invoice download workflow was denied by policy.'
      };
    }

    await this.internalApi.failRun(run.id, {
      organizationId: run.organizationId,
      currentStep: 'invoice_download_failed',
      errorMessage: message,
      stateJson: {
        failureType: error instanceof Error ? error.name : 'UnknownError'
      }
    });
    await this.receipts.createForRun({
      workflowRunId: run.id,
      finalStatus: ReceiptStatus.FAILED,
      summary: `Invoice download failed: ${message}`
    });

    return {
      status: 'completed',
      workflowRunId: run.id,
      message: 'Invoice download workflow failed.'
    };
  }

  private async executeRenewalCheck(data: WorkflowQueueJobData, jobId: string): Promise<WorkflowExecutionResult> {
    const run = await this.findExecutableRun(data.workflowRunId, data.organizationId);
    if (!run) {
      return {
        status: 'ignored',
        workflowRunId: data.workflowRunId,
        message: 'Workflow run is missing or no longer executable.'
      };
    }

    const artifactDir = await mkdtemp(join(tmpdir(), `agentpass-run-${run.id}-`));
    let browser: Awaited<ReturnType<typeof createControlledContext>> | null = null;

    try {
      const running = await this.markStarted(run, jobId, 'renewal_check_started');
      await this.heartbeat.heartbeat(running.id, jobId);

      if (await this.cancellation.isCanceled(running.id)) {
        return {
          status: 'ignored',
          workflowRunId: running.id,
          message: 'Workflow run was canceled during execution.'
        };
      }

      const policy = await this.loadPolicySnapshot(running.organizationId, running.agentId);
      const baseUrl = this.requireVendorUrl(run);
      this.assertPolicyAllowsDomain(baseUrl, policy.allowedDomains);

      const credentialId = this.requireCredentialId(run.workflow.configurationJson);
      const credentials = await this.decryptCredentials(credentialId, running.id);
      browser = await createControlledContext({
        workflowRunId: running.id,
        organizationId: running.organizationId,
        allowedDomains: policy.allowedDomains,
        artifactDir,
        timeoutMs: 10000,
        headless: true,
        allowPrivateNetwork: process.env.NODE_ENV !== 'production'
      });

      await this.internalApi.recordRunEvent(running.id, {
        organizationId: running.organizationId,
        eventType: AuditEventType.POLICY_EVALUATED,
        eventDataJson: {
          actionType: ActionType.OpenPage,
          decision: 'allow',
          allowedDomains: policy.allowedDomains
        }
      });

      const context = {
        workflowRunId: running.id,
        organizationId: running.organizationId,
        agentId: running.agentId,
        vendorId: running.vendorId,
        baseUrl,
        browser,
        credentials
      };

      await this.sandboxConnector.login(context);
      const renewal = await this.sandboxConnector.readRenewalInfo(context);
      const result = buildRenewalResult(renewal);
      const summary = renewalSummary(result);

      await this.internalApi.recordRunEvent(running.id, {
        organizationId: running.organizationId,
        eventType: AuditEventType.POLICY_EVALUATED,
        eventDataJson: {
          actionType: ActionType.ReadPage,
          decision: 'allow',
          riskLevel: 'low',
          extractedFields: Object.keys(result)
        }
      });

      const screenshot = await browser.captureScreenshot('renewal-check-complete');
      await this.uploadScreenshot(running, screenshot.path);

      await this.internalApi.completeRun(running.id, {
        organizationId: running.organizationId,
        currentStep: 'renewal_check_completed',
        resultSummary: summary,
        stateJson: {
          jobId,
          renewalResult: result
        }
      });
      await this.receipts.createForRun({
        workflowRunId: running.id,
        finalStatus: ReceiptStatus.COMPLETED,
        summary,
        resultJson: result
      });

      this.logger.info('Completed renewal check workflow job.', { workflowRunId: running.id, jobId });
      return {
        status: 'completed',
        workflowRunId: running.id,
        message: 'Renewal check workflow completed.'
      };
    } catch (error) {
      return this.handleRenewalFailure(run, error);
    } finally {
      if (browser) {
        await browser.closeContext();
      }
      await rm(artifactDir, { recursive: true, force: true });
    }
  }

  private async handleRenewalFailure(run: ExecutableRun, error: unknown): Promise<WorkflowExecutionResult> {
    const message = error instanceof Error ? error.message : 'Unknown renewal workflow error.';

    if (isPolicyDenial(error)) {
      const denied = await this.database.client.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.DENIED,
          completedAt: new Date(),
          currentStep: 'policy_denied',
          errorMessage: message,
          stateJson: this.nextState(run.stateJson, {
            status: WorkflowRunStatus.DENIED,
            reason: message,
            at: new Date().toISOString()
          })
        }
      });

      await this.audit.record({
        organizationId: denied.organizationId,
        workflowRunId: denied.id,
        agentId: denied.agentId,
        eventType: AuditEventType.WORKFLOW_RUN_DENIED,
        eventDataJson: {
          workflowRunId: denied.id,
          workflowId: denied.workflowId,
          reason: message
        }
      });
      await this.receipts.createForRun({
        workflowRunId: denied.id,
        finalStatus: ReceiptStatus.DENIED,
        summary: `Renewal check denied: ${message}`
      });

      return {
        status: 'completed',
        workflowRunId: denied.id,
        message: 'Renewal check workflow was denied by policy.'
      };
    }

    await this.internalApi.failRun(run.id, {
      organizationId: run.organizationId,
      currentStep: 'renewal_check_failed',
      errorMessage: message,
      stateJson: {
        failureType: error instanceof Error ? error.name : 'UnknownError'
      }
    });
    await this.receipts.createForRun({
      workflowRunId: run.id,
      finalStatus: ReceiptStatus.FAILED,
      summary: `Renewal check failed: ${message}`
    });

    return {
      status: 'completed',
      workflowRunId: run.id,
      message: 'Renewal check workflow failed.'
    };
  }

  private async executePlanDowngradeStart(data: WorkflowQueueJobData, jobId: string): Promise<WorkflowExecutionResult> {
    const run = await this.findExecutableRun(data.workflowRunId, data.organizationId);
    if (!run) {
      return {
        status: 'ignored',
        workflowRunId: data.workflowRunId,
        message: 'Workflow run is missing or no longer executable.'
      };
    }

    const artifactDir = await mkdtemp(join(tmpdir(), `agentpass-run-${run.id}-`));
    let browser: Awaited<ReturnType<typeof createControlledContext>> | null = null;

    try {
      const running = await this.markStarted(run, jobId, 'downgrade_proposal_started');
      await this.heartbeat.heartbeat(running.id, jobId);

      const policy = await this.loadPolicySnapshot(running.organizationId, running.agentId);
      const baseUrl = this.requireVendorUrl(run);
      this.assertPolicyAllowsDomain(baseUrl, policy.allowedDomains);

      const credentialId = this.requireCredentialId(run.workflow.configurationJson);
      const credentials = await this.decryptCredentials(credentialId, running.id);
      browser = await createControlledContext({
        workflowRunId: running.id,
        organizationId: running.organizationId,
        allowedDomains: policy.allowedDomains,
        artifactDir,
        timeoutMs: 10000,
        headless: true,
        allowPrivateNetwork: process.env.NODE_ENV !== 'production'
      });

      await this.internalApi.recordRunEvent(running.id, {
        organizationId: running.organizationId,
        eventType: AuditEventType.POLICY_EVALUATED,
        eventDataJson: {
          actionType: ActionType.OpenPage,
          decision: 'allow',
          allowedDomains: policy.allowedDomains
        }
      });

      const context = {
        workflowRunId: running.id,
        organizationId: running.organizationId,
        agentId: running.agentId,
        vendorId: running.vendorId,
        baseUrl,
        browser,
        credentials
      };

      await this.sandboxConnector.login(context);
      const proposal = await this.sandboxConnector.prepareDowngrade(context);
      if (proposal.policyDecision !== 'require_approval') {
        throw new DomainError(DomainErrorCode.ValidationFailed, 'Downgrade proposal must require approval in the MVP flow.');
      }

      const screenshot = await browser.captureScreenshot('downgrade-approval-request');
      const uploadedScreenshot = await this.uploadScreenshot(running, screenshot.path);
      const approval = await this.internalApi.createApprovalRequest(running.id, {
        actionAttemptId: proposal.actionAttemptId,
        summary: proposal.summary,
        riskLevel: toPrismaRiskLevelValue(proposal.riskLevel),
        amountCents: proposal.amountCents,
        screenshotFileId: uploadedScreenshot.data.id,
        policyTriggeredJson: {
          matchedRules: ['action.requires_approval.change_plan'],
          proposal: proposal.metadata
        }
      });

      this.logger.info('Plan downgrade workflow is waiting for approval.', {
        workflowRunId: running.id,
        approvalRequestId: approval.data.id,
        jobId
      });

      return {
        status: 'completed',
        workflowRunId: running.id,
        message: 'Plan downgrade workflow is waiting for approval.'
      };
    } catch (error) {
      return this.handlePlanDowngradeFailure(run, error, 'Plan downgrade proposal failed');
    } finally {
      if (browser) {
        await browser.closeContext();
      }
      await rm(artifactDir, { recursive: true, force: true });
    }
  }

  private async executeResume(data: WorkflowQueueJobData, jobId: string): Promise<WorkflowExecutionResult> {
    if (!data.approvalRequestId) {
      return {
        status: 'skipped',
        workflowRunId: data.workflowRunId,
        message: 'Resume jobs require an approval request ID.'
      };
    }

    const run = await this.findExecutableRun(data.workflowRunId, data.organizationId);
    if (!run) {
      return {
        status: 'ignored',
        workflowRunId: data.workflowRunId,
        message: 'Workflow run is missing or no longer executable.'
      };
    }

    if (run.workflow.template !== WorkflowTemplate.PLAN_DOWNGRADE_REQUEST) {
      return {
        status: 'skipped',
        workflowRunId: run.id,
        message: `Worker does not resume ${run.workflow.template} workflow jobs.`
      };
    }

    const artifactDir = await mkdtemp(join(tmpdir(), `agentpass-run-${run.id}-`));
    let browser: Awaited<ReturnType<typeof createControlledContext>> | null = null;

    try {
      const approval = await this.assertApprovalCanResume(run, data.approvalRequestId);
      await this.assertAgentActiveForResume(run);
      const running = await this.markStarted(run, jobId, 'downgrade_resume_started');

      const policy = await this.loadPolicySnapshot(running.organizationId, running.agentId);
      const baseUrl = this.requireVendorUrl(run);
      this.assertPolicyAllowsDomain(baseUrl, policy.allowedDomains);
      const credentialId = this.requireCredentialId(run.workflow.configurationJson);
      const credentials = await this.decryptCredentials(credentialId, running.id);

      browser = await createControlledContext({
        workflowRunId: running.id,
        organizationId: running.organizationId,
        allowedDomains: policy.allowedDomains,
        artifactDir,
        timeoutMs: 10000,
        headless: true,
        allowPrivateNetwork: process.env.NODE_ENV !== 'production'
      });

      const context = {
        workflowRunId: running.id,
        organizationId: running.organizationId,
        agentId: running.agentId,
        vendorId: running.vendorId,
        baseUrl,
        browser,
        credentials,
        approvalToken: approval.id
      };

      await this.sandboxConnector.login(context);
      const submitted = await this.sandboxConnector.submitDowngrade(context);
      const screenshot = await browser.captureScreenshot('downgrade-submitted');
      await this.uploadScreenshot(running, screenshot.path);

      await this.internalApi.completeRun(running.id, {
        organizationId: running.organizationId,
        currentStep: 'downgrade_completed',
        resultSummary: submitted.summary,
        stateJson: {
          jobId,
          approvalRequestId: approval.id,
          actionAttemptId: submitted.actionAttemptId,
          submittedAction: submitted.metadata
        }
      });
      await this.receipts.createForRun({
        workflowRunId: running.id,
        finalStatus: ReceiptStatus.COMPLETED,
        summary: submitted.summary,
        resultJson: {
          approvalRequestId: approval.id,
          actionAttemptId: submitted.actionAttemptId,
          status: submitted.status,
          ...submitted.metadata
        }
      });

      this.logger.info('Completed approved plan downgrade workflow job.', {
        workflowRunId: running.id,
        approvalRequestId: approval.id,
        jobId
      });

      return {
        status: 'completed',
        workflowRunId: running.id,
        message: 'Approved plan downgrade workflow completed.'
      };
    } catch (error) {
      return this.handlePlanDowngradeFailure(run, error, 'Plan downgrade resume failed');
    } finally {
      if (browser) {
        await browser.closeContext();
      }
      await rm(artifactDir, { recursive: true, force: true });
    }
  }

  private async handlePlanDowngradeFailure(
    run: ExecutableRun,
    error: unknown,
    prefix: string
  ): Promise<WorkflowExecutionResult> {
    const message = error instanceof Error ? error.message : 'Unknown plan downgrade workflow error.';

    if (isPolicyDenial(error)) {
      const denied = await this.database.client.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.DENIED,
          completedAt: new Date(),
          currentStep: 'policy_denied',
          errorMessage: message,
          stateJson: this.nextState(run.stateJson, {
            status: WorkflowRunStatus.DENIED,
            reason: message,
            at: new Date().toISOString()
          })
        }
      });

      await this.audit.record({
        organizationId: denied.organizationId,
        workflowRunId: denied.id,
        agentId: denied.agentId,
        eventType: AuditEventType.WORKFLOW_RUN_DENIED,
        eventDataJson: {
          workflowRunId: denied.id,
          workflowId: denied.workflowId,
          reason: message
        }
      });
      await this.receipts.createForRun({
        workflowRunId: denied.id,
        finalStatus: ReceiptStatus.DENIED,
        summary: `${prefix}: ${message}`
      });

      return {
        status: 'completed',
        workflowRunId: denied.id,
        message: `${prefix} by policy.`
      };
    }

    await this.internalApi.failRun(run.id, {
      organizationId: run.organizationId,
      currentStep: 'plan_downgrade_failed',
      errorMessage: message,
      stateJson: {
        failureType: error instanceof Error ? error.name : 'UnknownError'
      }
    });
    await this.receipts.createForRun({
      workflowRunId: run.id,
      finalStatus: ReceiptStatus.FAILED,
      summary: `${prefix}: ${message}`
    });

    return {
      status: 'completed',
      workflowRunId: run.id,
      message: `${prefix}.`
    };
  }

  private async executeNoop(data: WorkflowQueueJobData, jobId: string): Promise<WorkflowExecutionResult> {
    const run = await this.database.client.workflowRun.findFirst({
      where: {
        id: data.workflowRunId,
        organizationId: data.organizationId
      }
    });

    if (!run || isTerminal(run.status)) {
      return {
        status: 'ignored',
        workflowRunId: data.workflowRunId,
        message: 'Workflow run is missing or no longer executable.'
      };
    }

    const running = await this.markStarted(run, jobId, 'noop_worker_started');
    await this.heartbeat.heartbeat(running.id, jobId);

    if (await this.cancellation.isCanceled(running.id)) {
      return {
        status: 'ignored',
        workflowRunId: running.id,
        message: 'Workflow run was canceled during execution.'
      };
    }

    const completedAt = new Date();
    await this.database.client.workflowRun.update({
      where: { id: running.id },
      data: {
        status: WorkflowRunStatus.COMPLETED,
        completedAt,
        currentStep: 'noop_completed',
        resultSummary: 'Phase 19 no-op worker completed the queued workflow run.',
        stateJson: this.nextState(running.stateJson, {
          jobId,
          phase: 19,
          status: WorkflowRunStatus.COMPLETED,
          at: completedAt.toISOString()
        })
      }
    });

    await this.audit.record({
      organizationId: running.organizationId,
      workflowRunId: running.id,
      agentId: running.agentId,
      eventType: AuditEventType.WORKFLOW_RUN_COMPLETED,
      eventDataJson: {
        workflowRunId: running.id,
        workflowId: running.workflowId,
        jobId,
        noop: true
      }
    });

    this.logger.info('Completed noop workflow job.', { workflowRunId: running.id, jobId });
    return {
      status: 'completed',
      workflowRunId: running.id,
      message: 'No-op workflow completed.'
    };
  }

  private async findExecutableRun(runId: string, organizationId: string): Promise<ExecutableRun | null> {
    const run = await this.database.client.workflowRun.findFirst({
      where: {
        id: runId,
        organizationId
      },
      include: {
        workflow: { select: { configurationJson: true, template: true } },
        vendor: { select: { website: true } }
      }
    });

    if (!run || isTerminal(run.status)) {
      return null;
    }

    return run;
  }

  private async markStarted(run: WorkflowRun, jobId: string, currentStep: string): Promise<WorkflowRun> {
    const startedAt = run.startedAt ?? new Date();
    const running = await this.database.client.workflowRun.update({
      where: { id: run.id },
      data: {
        status: WorkflowRunStatus.RUNNING,
        startedAt,
        currentStep,
        stateJson: this.nextState(run.stateJson, {
          jobId,
          status: WorkflowRunStatus.RUNNING,
          at: startedAt.toISOString()
        })
      }
    });

    await this.audit.record({
      organizationId: running.organizationId,
      workflowRunId: running.id,
      agentId: running.agentId,
      eventType: AuditEventType.WORKFLOW_RUN_STARTED,
      eventDataJson: {
        workflowRunId: running.id,
        workflowId: running.workflowId,
        jobId
      }
    });

    return running;
  }

  private async assertApprovalCanResume(run: ExecutableRun, approvalRequestId: string) {
    const approval = await this.database.client.approvalRequest.findFirst({
      where: {
        id: approvalRequestId,
        workflowRunId: run.id,
        organizationId: run.organizationId
      }
    });

    if (!approval) {
      throw new DomainError(DomainErrorCode.NotFound, 'Approval request was not found.');
    }

    if (approval.status !== ApprovalStatus.APPROVED || !approval.approvedAt) {
      throw new DomainError(DomainErrorCode.ApprovalRequired, 'Approval must be approved before resume.');
    }

    if (approval.expiresAt && approval.approvedAt > approval.expiresAt) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Expired approval cannot resume.');
    }

    return approval;
  }

  private async assertAgentActiveForResume(run: WorkflowRun): Promise<void> {
    const agent = await this.database.client.agent.findFirst({
      where: {
        id: run.agentId,
        organizationId: run.organizationId
      },
      select: { status: true }
    });

    if (!agent || agent.status !== AgentStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.AgentNotActive, 'Agent must be active to resume workflow runs.');
    }
  }

  private async loadPolicySnapshot(organizationId: string, agentId: string): Promise<PolicySnapshot> {
    const policy = await this.database.client.policy.findFirst({
      where: {
        organizationId,
        agentId,
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE
      },
      select: { rulesJson: true }
    });

    if (!policy || !isJsonObject(policy.rulesJson)) {
      throw new DomainError(DomainErrorCode.PolicyDenied, 'Active agent policy was not found.');
    }

    const allowedDomains = Array.isArray(policy.rulesJson.allowedDomains)
      ? policy.rulesJson.allowedDomains.filter((domain): domain is string => typeof domain === 'string')
      : [];
    if (allowedDomains.length === 0) {
      throw new DomainError(DomainErrorCode.PolicyDenied, 'Policy does not allow any vendor domains.');
    }

    return { allowedDomains };
  }

  private assertPolicyAllowsDomain(url: string, allowedDomains: string[]): void {
    const hostname = new URL(url).hostname.toLowerCase();
    const allowed = allowedDomains.some((domain) => {
      const normalized = domain.toLowerCase();
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });

    if (!allowed) {
      throw new DomainError(DomainErrorCode.PolicyDenied, 'Vendor domain is not allowed by policy.', {
        hostname,
        allowedDomains
      });
    }
  }

  private requireVendorUrl(run: ExecutableRun): string {
    if (!run.vendor?.website) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invoice workflow requires a vendor website.');
    }

    return run.vendor.website;
  }

  private requireCredentialId(configurationJson: Prisma.JsonValue): string {
    if (!isJsonObject(configurationJson) || typeof configurationJson.credentialId !== 'string') {
      throw new DomainError(DomainErrorCode.CredentialUnavailable, 'Invoice workflow requires a credentialId.');
    }

    return configurationJson.credentialId;
  }

  private async decryptCredentials(credentialId: string, workflowRunId: string): Promise<VendorCredentials> {
    const decrypted = await this.internalApi.decryptCredentialForRun(credentialId, { workflowRunId });
    const { username, password } = decrypted.data.secretJson;
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new DomainError(DomainErrorCode.CredentialUnavailable, 'Credential payload must include username and password.');
    }

    return { username, password };
  }

  private async uploadInvoice(run: WorkflowRun, path: string, suggestedFilename: string): Promise<void> {
    const buffer = await readFile(path);
    await this.internalApi.uploadRunFile(run.id, {
      organizationId: run.organizationId,
      kind: FileKind.INVOICE,
      filename: suggestedFilename,
      mimeType: 'application/pdf',
      bufferBase64: buffer.toString('base64')
    });
  }

  private async uploadScreenshot(run: WorkflowRun, path: string) {
    const buffer = await readFile(path);
    return this.internalApi.uploadRunScreenshot(run.id, {
      organizationId: run.organizationId,
      filename: basename(path),
      mimeType: 'image/png',
      bufferBase64: buffer.toString('base64')
    });
  }

  private nextState(existing: Prisma.JsonValue, entry: Prisma.InputJsonObject): Prisma.InputJsonObject {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Prisma.JsonObject) : {};
    const workerEvents = Array.isArray(base.workerEvents) ? base.workerEvents : [];

    return {
      ...base,
      workerEvents: [...workerEvents, entry]
    };
  }
}

function isTerminal(status: WorkflowRunStatus): boolean {
  const terminalStatuses: WorkflowRunStatus[] = [
    WorkflowRunStatus.COMPLETED,
    WorkflowRunStatus.FAILED,
    WorkflowRunStatus.CANCELED,
    WorkflowRunStatus.DENIED
  ];

  return terminalStatuses.includes(status);
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPolicyDenial(error: unknown): boolean {
  return error instanceof DomainError && error.code === DomainErrorCode.PolicyDenied;
}

export function receiptStatusForWorkflowRun(status: WorkflowRunStatus): ReceiptStatus {
  return receiptStatusForRunStatus(status);
}

export type RenewalWorkflowResult = RenewalInfo & {
  monthlyPriceIncreaseCents: number;
  monthlyPriceIncreasePercent: number;
  annualizedSavingsOpportunityCents: number;
};

export function buildRenewalResult(info: RenewalInfo): RenewalWorkflowResult {
  const monthlyPriceIncreaseCents = info.renewalMonthlyPriceCents - info.currentMonthlyPriceCents;
  const monthlyPriceIncreasePercent =
    info.currentMonthlyPriceCents > 0
      ? Math.round((monthlyPriceIncreaseCents / info.currentMonthlyPriceCents) * 10000) / 100
      : 0;

  return {
    ...info,
    monthlyPriceIncreaseCents,
    monthlyPriceIncreasePercent,
    annualizedSavingsOpportunityCents: info.estimatedMonthlySavingsCents * 12
  };
}

function renewalSummary(result: RenewalWorkflowResult): string {
  return `${result.vendorName} renews on ${result.renewalDate}: monthly price increases by ${formatCents(
    result.monthlyPriceIncreaseCents
  )}, with ${formatCents(result.estimatedMonthlySavingsCents)} monthly savings opportunity.`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function toPrismaRiskLevelValue(riskLevel: string): string {
  return riskLevel.toUpperCase();
}
