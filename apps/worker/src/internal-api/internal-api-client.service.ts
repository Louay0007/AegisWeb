import { Inject, Injectable } from '@nestjs/common';
import { WorkerConfigService } from '../config/worker-config.service.js';

export type InternalApiHealthResult = {
  reachable: boolean;
  statusCode: number | null;
  message?: string;
};

export type WorkerScopedRequest = {
  organizationId: string;
};

export type WorkerRunEventRequest = WorkerScopedRequest & {
  eventType: string;
  eventDataJson?: Record<string, unknown>;
};

export type WorkerRunUploadRequest = WorkerScopedRequest & {
  filename: string;
  mimeType: string;
  bufferBase64: string;
};

export type WorkerRunFileUploadRequest = WorkerRunUploadRequest & {
  kind: string;
};

export type WorkerFileDto = {
  id: string;
  organizationId: string;
  workflowRunId: string | null;
  kind: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export type WorkerRunCompleteRequest = WorkerScopedRequest & {
  resultSummary?: string;
  currentStep?: string;
  stateJson?: Record<string, unknown>;
};

export type WorkerRunFailRequest = WorkerScopedRequest & {
  errorMessage: string;
  currentStep?: string;
  stateJson?: Record<string, unknown>;
};

export type WorkerCredentialDecryptRequest = {
  workflowRunId: string;
};

export type WorkerApprovalRequestInput = {
  actionAttemptId: string;
  summary: string;
  riskLevel?: string;
  amountCents?: number;
  screenshotFileId?: string;
  policyTriggeredJson?: Record<string, unknown>;
  expiresAt?: string;
};

export type WorkerApprovalDto = {
  id: string;
  workflowRunId: string;
  actionAttemptId: string;
  status: string;
  summary: string;
};

export type InternalApiEnvelope<T> = {
  data: T;
};

export type DecryptedRunCredential = {
  credentialId: string;
  workflowRunId: string;
  agentId: string;
  secretJson: {
    username?: unknown;
    password?: unknown;
    [key: string]: unknown;
  };
};

@Injectable()
export class InternalApiClient {
  private runToken: string | undefined;

  constructor(@Inject(WorkerConfigService) private readonly config: WorkerConfigService) {}

  setRunToken(token: string | undefined): void {
    this.runToken = token;
  }

  clearRunToken(): void {
    this.runToken = undefined;
  }

  async checkHealth(): Promise<InternalApiHealthResult> {
    try {
      const response = await fetch(new URL('/health', this.config.config.apiBaseUrl), {
        headers: {
          'x-worker-token': this.config.config.workerInternalToken
        }
      });

      return {
        reachable: response.ok,
        statusCode: response.status,
        message: response.ok ? undefined : `API returned ${response.status}`
      };
    } catch (error) {
      return {
        reachable: false,
        statusCode: null,
        message: error instanceof Error ? error.message : 'Unknown API reachability error'
      };
    }
  }

  recordRunEvent(runId: string, body: WorkerRunEventRequest): Promise<unknown> {
    return this.postJson(`/internal/workers/runs/${runId}/events`, body);
  }

  uploadRunScreenshot(runId: string, body: WorkerRunUploadRequest): Promise<InternalApiEnvelope<WorkerFileDto>> {
    return this.postJson<InternalApiEnvelope<WorkerFileDto>>(`/internal/workers/runs/${runId}/screenshots`, body);
  }

  uploadRunFile(runId: string, body: WorkerRunFileUploadRequest): Promise<InternalApiEnvelope<WorkerFileDto>> {
    return this.postJson<InternalApiEnvelope<WorkerFileDto>>(`/internal/workers/runs/${runId}/files`, body);
  }

  completeRun(runId: string, body: WorkerRunCompleteRequest): Promise<unknown> {
    return this.postJson(`/internal/workers/runs/${runId}/complete`, body);
  }

  failRun(runId: string, body: WorkerRunFailRequest): Promise<unknown> {
    return this.postJson(`/internal/workers/runs/${runId}/fail`, body);
  }

  decryptCredentialForRun(
    credentialId: string,
    body: WorkerCredentialDecryptRequest
  ): Promise<InternalApiEnvelope<DecryptedRunCredential>> {
    return this.postJson<InternalApiEnvelope<DecryptedRunCredential>>(
      `/internal/vault/credentials/${credentialId}/decrypt-for-run`,
      body
    );
  }

  createApprovalRequest(runId: string, body: WorkerApprovalRequestInput): Promise<InternalApiEnvelope<WorkerApprovalDto>> {
    return this.postJson<InternalApiEnvelope<WorkerApprovalDto>>(
      `/internal/workers/runs/${runId}/approval-requests`,
      body
    );
  }

  private async postJson<T = unknown>(path: string, body: object): Promise<T> {
    const response = await fetch(new URL(path, this.config.config.apiBaseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-worker-token': this.runToken ?? this.config.config.workerInternalToken
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (!response.ok) {
      throw new Error(`Internal API ${path} returned ${response.status}: ${JSON.stringify(payload)}`);
    }

    return payload as T;
  }
}
