import { Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode, RISK_SIGNALS, RiskSignal } from '@agentpass/domain';

@Injectable()
export class RiskSignalService {
  normalize(value: unknown): RiskSignal[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Risk signals must be an array.');
    }

    for (const signal of value) {
      if (typeof signal !== 'string' || !RISK_SIGNALS.includes(signal as RiskSignal)) {
        throw new DomainError(DomainErrorCode.ValidationFailed, 'Risk signals must be known values.');
      }
    }

    return [...new Set(value as RiskSignal[])].sort();
  }
}
