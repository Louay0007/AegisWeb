import { Inject, Injectable } from '@nestjs/common';
import { DependencyHealth, getPackageVersion, nowIso, SERVICE_NAMES, ServiceHealth } from '@agentpass/domain';
import { checkRedis, checkS3 } from '@agentpass/database';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(DatabaseService) private readonly databaseService: DatabaseService
  ) {}

  getLiveness(): ServiceHealth {
    return {
      service: SERVICE_NAMES.api,
      state: 'ok',
      version: getPackageVersion(),
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: nowIso()
    };
  }

  async getReadiness(): Promise<ServiceHealth> {
    const dependencies = await Promise.all([
      this.checkDatabase(),
      checkRedis(this.configService.redisUrl),
      checkS3(this.configService.s3)
    ]);

    return {
      ...this.getLiveness(),
      state: dependencies.every((dependency) => dependency.state === 'ok') ? 'ok' : 'degraded',
      dependencies
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const startedAt = performance.now();

    try {
      await this.databaseService.ping();
      return {
        name: SERVICE_NAMES.postgres,
        state: 'ok',
        latencyMs: Math.round(performance.now() - startedAt)
      };
    } catch (error) {
      return {
        name: SERVICE_NAMES.postgres,
        state: 'down',
        latencyMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : 'Unknown database health error'
      };
    }
  }
}

export function summarizeDependencyHealth(dependencies: DependencyHealth[]): string {
  return dependencies.map((dependency) => `${dependency.name}:${dependency.state}`).join(',');
}
