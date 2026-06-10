import { Inject, Injectable, OnApplicationShutdown, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createPrismaClient } from '@agentpass/database';
import { ConfigService } from '../config/config.service.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private readonly prisma: PrismaClient;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.prisma = createPrismaClient(this.configService.databaseUrl);
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async ping(): Promise<boolean> {
    await this.prisma.$queryRaw`select 1`;
    return true;
  }

  async transaction<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(handler);
  }
}
