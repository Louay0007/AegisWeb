import { Inject, Injectable } from '@nestjs/common';
import { checkRedis, checkS3 } from '@agentpass/database';
import { DependencyHealth, SERVICE_NAMES } from '@agentpass/domain';
import { getBrowserRuntimeStatus } from '@agentpass/browser-runtime';
import { WorkerConfigService } from '../config/worker-config.service.js';
import { InternalApiClient } from '../internal-api/internal-api-client.service.js';

export type WorkerRuntimeChecks = {
  redis: DependencyHealth;
  api: DependencyHealth;
  minio: DependencyHealth;
  browserRuntime: DependencyHealth;
};

@Injectable()
export class WorkerRuntimeService {
  constructor(
    @Inject(WorkerConfigService) private readonly config: WorkerConfigService,
    @Inject(InternalApiClient) private readonly api: InternalApiClient
  ) {}

  async checkBootDependencies(): Promise<WorkerRuntimeChecks> {
    const [redis, api, minio] = await Promise.all([
      checkRedis(this.config.config.redisUrl),
      this.checkApi(),
      checkS3({
        endpoint: this.config.config.s3Endpoint,
        region: this.config.config.s3Region,
        accessKeyId: this.config.config.s3AccessKey,
        secretAccessKey: this.config.config.s3SecretKey,
        forcePathStyle: this.config.config.s3ForcePathStyle
      })
    ]);

    return {
      redis,
      api,
      minio,
      browserRuntime: this.checkBrowserRuntime()
    };
  }

  private async checkApi(): Promise<DependencyHealth> {
    const startedAt = performance.now();
    const result = await this.api.checkHealth();

    return {
      name: SERVICE_NAMES.api,
      state: result.reachable ? 'ok' : 'down',
      latencyMs: Math.round(performance.now() - startedAt),
      message: result.message
    };
  }

  private checkBrowserRuntime(): DependencyHealth {
    const status = getBrowserRuntimeStatus();

    return {
      name: SERVICE_NAMES.worker,
      state: status.ready ? 'ok' : 'down',
      message: status.runtime
    };
  }
}
