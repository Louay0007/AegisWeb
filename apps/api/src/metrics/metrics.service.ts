import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

type RequestLabels = {
  method: string;
  route: string;
  statusCode: string;
};

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequests: Counter<string>;
  private readonly httpDuration: Histogram<string>;
  private readonly workflowRuns: Counter<string>;
  private readonly approvalsPending: Gauge<string>;
  private readonly credentialDecrypts: Counter<string>;
  private readonly credentialGrants: Counter<string>;
  private readonly queueDepth: Gauge<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'aegisweb_' });
    this.httpRequests = new Counter({
      name: 'aegisweb_http_requests_total',
      help: 'Total API HTTP requests.',
      labelNames: ['method', 'route', 'statusCode'],
      registers: [this.registry]
    });
    this.httpDuration = new Histogram({
      name: 'aegisweb_http_request_duration_seconds',
      help: 'API HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'statusCode'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry]
    });
    this.workflowRuns = new Counter({
      name: 'aegisweb_workflow_runs_total',
      help: 'Workflow runs by observed status and template.',
      labelNames: ['status', 'workflowTemplate'],
      registers: [this.registry]
    });
    this.approvalsPending = new Gauge({
      name: 'aegisweb_approvals_pending',
      help: 'Pending approval requests.',
      registers: [this.registry]
    });
    this.credentialDecrypts = new Counter({
      name: 'aegisweb_credential_decrypt_total',
      help: 'Credential decrypt attempts by result.',
      labelNames: ['result'],
      registers: [this.registry]
    });
    this.credentialGrants = new Counter({
      name: 'aegisweb_credential_grants_total',
      help: 'Credential grant operations by result.',
      labelNames: ['result'],
      registers: [this.registry]
    });
    this.queueDepth = new Gauge({
      name: 'aegisweb_queue_depth',
      help: 'BullMQ queue depth by queue name.',
      labelNames: ['queueName'],
      registers: [this.registry]
    });
  }

  observeHttpRequest(labels: RequestLabels, durationMs: number): void {
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationMs / 1000);
  }

  recordWorkflowRun(status: string, workflowTemplate = 'unknown'): void {
    this.workflowRuns.inc({ status, workflowTemplate });
  }

  setPendingApprovals(count: number): void {
    this.approvalsPending.set(count);
  }

  recordCredentialDecrypt(result: 'success' | 'failure'): void {
    this.credentialDecrypts.inc({ result });
  }

  recordCredentialGrant(result: 'success' | 'failure'): void {
    this.credentialGrants.inc({ result });
  }

  setQueueDepth(queueName: string, depth: number): void {
    this.queueDepth.set({ queueName }, depth);
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
