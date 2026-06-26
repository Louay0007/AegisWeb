import { Injectable } from '@nestjs/common';
import { Logger } from 'pino';
import { createWorkerPinoLogger } from './worker-pino-logger.js';

@Injectable()
export class WorkerLogger {
  private readonly logger: Logger = createWorkerPinoLogger();

  info(message: string, metadata: Record<string, unknown> = {}): void {
    this.logger.info(metadata, message);
  }

  warn(message: string, metadata: Record<string, unknown> = {}): void {
    this.logger.warn(metadata, message);
  }

  error(message: string, error: unknown, metadata: Record<string, unknown> = {}): void {
    this.logger.error({ ...metadata, error: error instanceof Error ? error.message : String(error) }, message);
  }
}
