import { Injectable } from '@nestjs/common';
import { isSecretFieldName } from '@agentpass/domain';

const REDACTED = '[REDACTED]';

@Injectable()
export class AuditRedactionService {
  redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.redact(entry));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          isSecretFieldName(key) ? REDACTED : this.redact(entry)
        ])
      );
    }

    return value;
  }
}
