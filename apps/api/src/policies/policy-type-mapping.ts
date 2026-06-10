import {
  AgentStatus as PrismaAgentStatus,
  PolicyStatus as PrismaPolicyStatus,
  PolicyType as PrismaPolicyType
} from '@prisma/client';
import { AgentStatus, PolicyStatus, PolicyType } from '@agentpass/domain';

export function toPrismaPolicyType(type: PolicyType): PrismaPolicyType {
  switch (type) {
    case PolicyType.WebsiteAllowlist:
      return PrismaPolicyType.WEBSITE_ALLOWLIST;
    case PolicyType.ActionPermissions:
      return PrismaPolicyType.ACTION_PERMISSIONS;
    case PolicyType.SpendingLimits:
      return PrismaPolicyType.SPENDING_LIMITS;
    case PolicyType.DataAccess:
      return PrismaPolicyType.DATA_ACCESS;
    case PolicyType.TimeWindow:
      return PrismaPolicyType.TIME_WINDOW;
    case PolicyType.ApprovalRules:
      return PrismaPolicyType.APPROVAL_RULES;
    case PolicyType.AgentPolicyBundle:
      return PrismaPolicyType.AGENT_POLICY_BUNDLE;
  }
}

export function fromPrismaPolicyType(type: PrismaPolicyType): PolicyType {
  switch (type) {
    case PrismaPolicyType.WEBSITE_ALLOWLIST:
      return PolicyType.WebsiteAllowlist;
    case PrismaPolicyType.ACTION_PERMISSIONS:
      return PolicyType.ActionPermissions;
    case PrismaPolicyType.SPENDING_LIMITS:
      return PolicyType.SpendingLimits;
    case PrismaPolicyType.DATA_ACCESS:
      return PolicyType.DataAccess;
    case PrismaPolicyType.TIME_WINDOW:
      return PolicyType.TimeWindow;
    case PrismaPolicyType.APPROVAL_RULES:
      return PolicyType.ApprovalRules;
    case PrismaPolicyType.AGENT_POLICY_BUNDLE:
      return PolicyType.AgentPolicyBundle;
  }
}

export function toPrismaPolicyStatus(status: PolicyStatus): PrismaPolicyStatus {
  switch (status) {
    case PolicyStatus.Active:
      return PrismaPolicyStatus.ACTIVE;
    case PolicyStatus.Draft:
      return PrismaPolicyStatus.DRAFT;
    case PolicyStatus.Archived:
      return PrismaPolicyStatus.ARCHIVED;
  }
}

export function fromPrismaPolicyStatus(status: PrismaPolicyStatus): PolicyStatus {
  switch (status) {
    case PrismaPolicyStatus.ACTIVE:
      return PolicyStatus.Active;
    case PrismaPolicyStatus.DRAFT:
      return PolicyStatus.Draft;
    case PrismaPolicyStatus.ARCHIVED:
      return PolicyStatus.Archived;
  }
}

export function fromPrismaAgentStatus(status: PrismaAgentStatus): AgentStatus {
  switch (status) {
    case PrismaAgentStatus.ACTIVE:
      return AgentStatus.Active;
    case PrismaAgentStatus.PAUSED:
      return AgentStatus.Paused;
    case PrismaAgentStatus.REVOKED:
      return AgentStatus.Revoked;
  }
}
