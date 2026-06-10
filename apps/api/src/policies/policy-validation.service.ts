import { Injectable } from '@nestjs/common';
import {
  ACTION_TYPES,
  AgentPolicySnapshot,
  DomainError,
  DomainErrorCode,
  RISK_SIGNALS,
  RiskSignal
} from '@agentpass/domain';

type RecordLike = Record<string, unknown>;

@Injectable()
export class PolicyValidationService {
  validateSnapshot(value: unknown): AgentPolicySnapshot {
    if (!isRecord(value)) {
      throw this.invalid('Policy rules must be an object.');
    }

    const snapshot: AgentPolicySnapshot = {
      allowedDomains: this.stringArray(value.allowedDomains, 'allowedDomains'),
      blockedDomains: this.stringArray(value.blockedDomains, 'blockedDomains'),
      allowedActions: this.actionArray(value.allowedActions, 'allowedActions'),
      deniedActions: this.actionArray(value.deniedActions, 'deniedActions'),
      approvalRequiredActions: this.actionArray(value.approvalRequiredActions, 'approvalRequiredActions'),
      autoApproveBelowCents: this.money(value.autoApproveBelowCents, 'autoApproveBelowCents'),
      approvalRequiredAboveCents: this.money(value.approvalRequiredAboveCents, 'approvalRequiredAboveCents'),
      denyAboveCents: this.money(value.denyAboveCents, 'denyAboveCents'),
      dangerKeywords: this.stringArray(value.dangerKeywords ?? [], 'dangerKeywords'),
      businessHours: this.businessHours(value.businessHours ?? { enabled: false })
    };

    for (const domain of [...snapshot.allowedDomains, ...snapshot.blockedDomains]) {
      if (!isValidDomain(domain)) {
        throw this.invalid('Policy domains must be hostnames without a URL scheme.');
      }
    }

    if (snapshot.allowedDomains.length === 0) {
      throw this.invalid('At least one allowed domain is required.');
    }

    if (snapshot.autoApproveBelowCents > snapshot.approvalRequiredAboveCents) {
      throw this.invalid('Auto-approval threshold cannot exceed the approval threshold.');
    }

    if (snapshot.approvalRequiredAboveCents > snapshot.denyAboveCents) {
      throw this.invalid('Approval threshold cannot exceed the hard denial threshold.');
    }

    if (snapshot.dangerKeywords.some((keyword) => keyword.length === 0)) {
      throw this.invalid('Danger keywords cannot be empty.');
    }

    return snapshot;
  }

  validateRiskSignals(value: unknown): RiskSignal[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw this.invalid('Risk signals must be an array.');
    }

    for (const signal of value) {
      if (typeof signal !== 'string' || !RISK_SIGNALS.includes(signal as RiskSignal)) {
        throw this.invalid('Risk signals must be known values.');
      }
    }

    return [...new Set(value as RiskSignal[])].sort();
  }

  private stringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw this.invalid(`${field} must be an array of strings.`);
    }

    return [...new Set(value.map((item) => item.trim().toLowerCase()))];
  }

  private actionArray(value: unknown, field: string): AgentPolicySnapshot['allowedActions'] {
    if (!Array.isArray(value)) {
      throw this.invalid(`${field} must be an array of action types.`);
    }

    for (const action of value) {
      if (typeof action !== 'string' || !ACTION_TYPES.includes(action as AgentPolicySnapshot['allowedActions'][number])) {
        throw this.invalid(`${field} contains an unknown action type.`);
      }
    }

    return [...new Set(value as AgentPolicySnapshot['allowedActions'])].sort();
  }

  private money(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw this.invalid(`${field} must be a non-negative integer.`);
    }

    return value;
  }

  private businessHours(value: unknown): AgentPolicySnapshot['businessHours'] {
    if (!isRecord(value) || typeof value.enabled !== 'boolean') {
      throw this.invalid('businessHours.enabled must be boolean.');
    }

    const policy: AgentPolicySnapshot['businessHours'] = {
      enabled: value.enabled
    };

    if (value.timezone !== undefined) {
      if (typeof value.timezone !== 'string' || value.timezone.trim().length === 0) {
        throw this.invalid('businessHours.timezone must be a non-empty string.');
      }
      policy.timezone = value.timezone.trim();
    }

    if (value.weekdays !== undefined) {
      if (
        !Array.isArray(value.weekdays) ||
        value.weekdays.some((day) => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6)
      ) {
        throw this.invalid('businessHours.weekdays must contain integers from 0 to 6.');
      }
      policy.weekdays = [...new Set(value.weekdays)].sort();
    }

    if (value.startHour !== undefined || value.endHour !== undefined) {
      const startHour = value.startHour;
      const endHour = value.endHour;
      if (
        typeof startHour !== 'number' ||
        typeof endHour !== 'number' ||
        !Number.isInteger(startHour) ||
        !Number.isInteger(endHour) ||
        startHour < 0 ||
        startHour > 23 ||
        endHour < 1 ||
        endHour > 24 ||
        startHour >= endHour
      ) {
        throw this.invalid('businessHours start and end hours are invalid.');
      }
      policy.startHour = startHour;
      policy.endHour = endHour;
    }

    return policy;
  }

  private invalid(message: string): DomainError {
    return new DomainError(DomainErrorCode.ValidationFailed, message);
  }
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDomain(value: string): boolean {
  if (value.length === 0 || value.includes('://') || value.includes('/') || value.includes(' ') || value.includes('@')) {
    return false;
  }

  if (value.includes(':')) {
    const port = Number(value.split(':')[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return false;
    }
  }

  const withoutPort = value.startsWith('[') ? value : value.split(':')[0];
  if (withoutPort === 'localhost') {
    return true;
  }

  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(withoutPort);
}
