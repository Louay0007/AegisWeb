import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VendorSandboxModule } from './vendor-sandbox.module.js';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(VendorSandboxModule);
  const port = Number(process.env.VENDOR_SANDBOX_PORT ?? 4202);

  await app.listen(port);
  Logger.log(`AgentPass vendor sandbox listening on http://localhost:${port}`, 'VendorSandboxBootstrap');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await bootstrap();
}
