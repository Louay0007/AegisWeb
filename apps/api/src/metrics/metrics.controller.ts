import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { MetricsService } from './metrics.service.js';

type MetricsResponse = {
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(DatabaseService) private readonly database: DatabaseService
  ) {}

  @Get()
  async scrape(@Res() response: MetricsResponse): Promise<void> {
    const pendingApprovals = await this.database.client.approvalRequest.count({
      where: { status: ApprovalStatus.PENDING }
    });
    this.metrics.setPendingApprovals(pendingApprovals);
    response.setHeader('Content-Type', this.metrics.contentType());
    response.send(await this.metrics.metrics());
  }
}
