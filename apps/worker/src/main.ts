import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkerModule } from './worker.module.js';
import { WorkerService } from './worker.service.js';

export async function createWorkerApplicationContext() {
  return NestFactory.createApplicationContext(WorkerModule);
}

export async function bootstrap(): Promise<void> {
  const app = await createWorkerApplicationContext();
  const worker = app.get(WorkerService);
  await worker.start();
  const status = worker.getStatus();

  Logger.log(`AgentPass worker booted in ${status.mode} mode`, 'WorkerBootstrap');

  setInterval(() => {
    worker.heartbeat();
  }, 30000);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await bootstrap();
}
