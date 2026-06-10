import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WorkerLogger {
  private readonly logger = new Logger('AgentPassWorker');

  info(message: string, metadata: Record<string, unknown> = {}): void {
    this.logger.log(format(message, metadata));
  }

  warn(message: string, metadata: Record<string, unknown> = {}): void {
    this.logger.warn(format(message, metadata));
  }

  error(message: string, error: unknown, metadata: Record<string, unknown> = {}): void {
    this.logger.error(format(message, { ...metadata, error: error instanceof Error ? error.message : String(error) }));
  }
}

function format(message: string, metadata: Record<string, unknown>): string {
  return Object.keys(metadata).length > 0 ? `${message} ${JSON.stringify(metadata)}` : message;
}
