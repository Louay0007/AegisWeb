import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createPrismaClient } from '@agentpass/database';
import { WorkerConfigService } from '../config/worker-config.service.js';

@Injectable()
export class WorkerDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor(@Inject(WorkerConfigService) config: WorkerConfigService) {
    this.prisma = createPrismaClient(config.config.databaseUrl);
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async transaction<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(handler);
  }
}
