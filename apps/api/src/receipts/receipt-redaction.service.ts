import { Injectable } from '@nestjs/common';

const sensitiveKeyPattern = /password|secret|token|authorization|cookie|credential|encryptedpayload|ciphertext|auth_tag|username|responseText/i;

@Injectable()
export class ReceiptRedactionService {
  redact<T>(value: T): T {
    return redactValue(value) as T;
  }
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      redacted[key] = sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactValue(child);
    }
    return redacted;
  }

  return value;
}
