import { Inject, Injectable } from '@nestjs/common';
import { getBrowserRuntimeStatus } from '@agentpass/browser-runtime';
import { nowIso, SERVICE_NAMES } from '@agentpass/domain';
import { WorkerQueueService } from './queue/worker-queue.service.js';
import { WorkerRuntimeService } from './runtime/worker-runtime.service.js';

@Injectable()
export class WorkerService {
  private heartbeatAt = nowIso();

  constructor(
    @Inject(WorkerQueueService) private readonly queue: WorkerQueueService,
    @Inject(WorkerRuntimeService) private readonly runtime: WorkerRuntimeService
  ) {}

  getStatus() {
    return {
      service: SERVICE_NAMES.worker,
      state: 'ok' as const,
      mode: 'phase-19-worker-foundation',
      heartbeatAt: this.heartbeatAt,
      browserRuntime: getBrowserRuntimeStatus(),
      queue: this.queue.getStatus()
    };
  }

  heartbeat(): void {
    this.heartbeatAt = nowIso();
  }

  async start(): Promise<void> {
    await this.queue.start();
  }

  async stop(): Promise<void> {
    await this.queue.stop();
  }

  checkBootDependencies() {
    return this.runtime.checkBootDependencies();
  }
}
