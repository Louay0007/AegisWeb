import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger, LoggerOptions } from 'pino';

type LogMetadata = Record<string, unknown>;

@Injectable()
export class PinoLoggingService implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino(createLoggerOptions());
  }

  log(message: unknown, context?: string): void {
    this.info(String(message), context ? { context } : undefined);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  info(message: string, metadata: LogMetadata = {}): void {
    this.logger.info(metadata, message);
  }

  child(bindings: LogMetadata): Logger {
    return this.logger.child(bindings);
  }
}

function createLoggerOptions(): LoggerOptions {
  return {
    base: { service: 'aegisweb-api' },
    level: process.env.LOG_LEVEL ?? defaultLogLevel(),
    redact: {
      paths: ['password', 'token', 'accessToken', 'refreshToken', '*.password', '*.token', '*.accessToken', '*.refreshToken'],
      censor: '[REDACTED]'
    },
    timestamp: pino.stdTimeFunctions.isoTime
  };
}

function defaultLogLevel(): string {
  if (process.env.NODE_ENV === 'test') return 'silent';
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}
