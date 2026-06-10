import { describe, expect, it } from 'vitest';
import {
  ActionType,
  AgentPolicySnapshot,
  AgentStatus,
  PolicyDecision,
  RiskLevel,
  RiskSignal
} from '@agentpass/domain';
import { evaluatePolicy, extractRiskSignals, getPolicyEngineStatus, scoreRisk } from '@agentpass/policy-engine';

const basePolicy: AgentPolicySnapshot = {
  allowedDomains: ['localhost', 'acme.example.com'],
  blockedDomains: ['blocked.example.com', 'bank.example'],
  allowedActions: [
    ActionType.OpenPage,
    ActionType.ReadPage,
    ActionType.DownloadFile,
    ActionType.CredentialInjection,
    ActionType.MakePurchase
  ],
  deniedActions: [ActionType.InviteUser, ActionType.ChangeBillingDetails],
  approvalRequiredActions: [ActionType.ChangePlan, ActionType.CancelSubscription],
  autoApproveBelowCents: 10000,
  approvalRequiredAboveCents: 10000,
  denyAboveCents: 100000,
  dangerKeywords: ['delete', 'cancel', 'confirm', 'wire', 'bank', 'admin', 'owner'],
  businessHours: { enabled: false }
};

function input(overrides: Partial<Parameters<typeof evaluatePolicy>[0]> = {}) {
  return {
    organizationId: 'org_policy',
    agentId: 'agent_policy',
    agentStatus: AgentStatus.Active,
    website: 'http://localhost:4202/billing',
    actionType: ActionType.ReadPage,
    riskSignals: [],
    policySnapshot: basePolicy,
    now: '2026-06-06T00:00:00.000Z',
    ...overrides
  };
}

describe('phase 11 policy engine library', () => {
  it('reports the real policy engine mode', () => {
    expect(getPolicyEngineStatus()).toEqual({
      ready: true,
      mode: 'phase-11-policy-engine'
    });
  });

  it.each([
    ['allowed domain + read page -> allow', input(), PolicyDecision.Allow],
    [
      'allowed domain + download invoice -> allow',
      input({ actionType: ActionType.DownloadFile }),
      PolicyDecision.Allow
    ],
    [
      'unknown domain + read page -> deny',
      input({ website: 'https://unknown.example.com/dashboard' }),
      PolicyDecision.Deny
    ],
    [
      'blocked domain + read page -> deny',
      input({ website: 'https://blocked.example.com/dashboard' }),
      PolicyDecision.Deny
    ],
    [
      'allowed domain + change plan -> require_approval',
      input({ actionType: ActionType.ChangePlan }),
      PolicyDecision.RequireApproval
    ],
    [
      'allowed domain + cancel subscription -> require_approval',
      input({ actionType: ActionType.CancelSubscription }),
      PolicyDecision.RequireApproval
    ],
    [
      'allowed domain + invite admin -> deny',
      input({ actionType: ActionType.InviteUser }),
      PolicyDecision.Deny
    ],
    [
      'allowed domain + change bank details -> deny',
      input({ actionType: ActionType.ChangeBillingDetails }),
      PolicyDecision.Deny
    ],
    [
      'purchase below threshold -> allow',
      input({ actionType: ActionType.MakePurchase, amountCents: 5000 }),
      PolicyDecision.Allow
    ],
    [
      'purchase between thresholds -> require_approval',
      input({ actionType: ActionType.MakePurchase, amountCents: 50000 }),
      PolicyDecision.RequireApproval
    ],
    [
      'purchase above hard limit -> deny',
      input({ actionType: ActionType.MakePurchase, amountCents: 150000 }),
      PolicyDecision.Deny
    ],
    [
      'credential use on unknown vendor -> deny',
      input({
        actionType: ActionType.CredentialInjection,
        website: 'https://unknown.example.com/login',
        riskSignals: [RiskSignal.CredentialUsed, RiskSignal.UnknownDomain]
      }),
      PolicyDecision.Deny
    ],
    [
      'paused agent -> deny',
      input({ agentStatus: AgentStatus.Paused }),
      PolicyDecision.Deny
    ],
    [
      'revoked agent -> deny',
      input({ agentStatus: AgentStatus.Revoked }),
      PolicyDecision.Deny
    ]
  ])('%s', (_name, policyInput, expectedDecision) => {
    expect(evaluatePolicy(policyInput).decision).toBe(expectedDecision);
  });

  it('scores danger keywords as high and credential use on known vendors as medium', () => {
    const dangerSignals = extractRiskSignals({
      website: 'http://localhost:4202/billing',
      actionType: ActionType.ReadPage,
      text: 'Confirm cancel and delete this subscription',
      policySnapshot: basePolicy
    });
    const credentialSignals = extractRiskSignals({
      website: 'http://localhost:4202/login',
      actionType: ActionType.CredentialInjection,
      credentialUsed: true,
      knownVendor: true,
      policySnapshot: basePolicy
    });

    expect(dangerSignals).toContain(RiskSignal.DestructiveKeyword);
    expect(scoreRisk({ actionType: ActionType.ReadPage, riskSignals: dangerSignals })).toBe(RiskLevel.High);
    expect(credentialSignals).toContain(RiskSignal.CredentialUsed);
    expect(scoreRisk({ actionType: ActionType.ReadPage, riskSignals: credentialSignals })).toBe(RiskLevel.Medium);
  });

  it('returns deterministic matched rule reasons in decision order', () => {
    const results = {
      allowRead: evaluatePolicy(input()),
      blockedDomain: evaluatePolicy(input({ website: 'https://blocked.example.com/settings' })),
      hardLimit: evaluatePolicy(input({ actionType: ActionType.MakePurchase, amountCents: 150000 })),
      approvalAction: evaluatePolicy(input({ actionType: ActionType.ChangePlan })),
      approvalRisk: evaluatePolicy(
        input({
          actionType: ActionType.ReadPage,
          riskSignals: [RiskSignal.DestructiveKeyword]
        })
      )
    };

    expect(Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value.matchedRules]))).toMatchInlineSnapshot(`
      {
        "allowRead": [
          "action.allowed.read_page",
        ],
        "approvalAction": [
          "action.requires_approval.change_plan",
        ],
        "approvalRisk": [
          "risk.requires_approval.high",
        ],
        "blockedDomain": [
          "domain.blocked",
        ],
        "hardLimit": [
          "amount.hard_limit",
        ],
      }
    `);
  });

  it('keeps hard deny rules ahead of approval rules for high value purchases', () => {
    const result = evaluatePolicy(
      input({
        actionType: ActionType.MakePurchase,
        amountCents: 150000,
        policySnapshot: {
          ...basePolicy,
          approvalRequiredActions: [ActionType.MakePurchase]
        }
      })
    );

    expect(result).toMatchObject({
      decision: PolicyDecision.Deny,
      matchedRules: ['amount.hard_limit']
    });
  });
});
