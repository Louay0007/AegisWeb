import pino, { Logger } from 'pino';

export function createWorkerPinoLogger(): Logger {
  return pino({
    base: { service: 'aegisweb-worker' },
    level: process.env.LOG_LEVEL ?? defaultLogLevel(),
    redact: {
      paths: ['password', 'token', 'accessToken', 'refreshToken', '*.password', '*.token', '*.accessToken', '*.refreshToken'],
      censor: '[REDACTED]'
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

function defaultLogLevel(): string {
  if (process.env.NODE_ENV === 'test') return 'silent';
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}
