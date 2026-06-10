import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ServiceHealth } from '@agentpass/domain';
import { PublicRoute } from '../authorization/authorization-metadata.js';
import { HealthService } from './health.service.js';

@PublicRoute()
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealth(): ServiceHealth {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(): Promise<ServiceHealth> {
    const readiness = await this.healthService.getReadiness();

    if (readiness.state !== 'ok') {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
