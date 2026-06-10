import { describe, expect, it } from 'vitest';

const crossOrganizationCoverage = [
  'tests/phase5-authorization.spec.ts',
  'tests/phase6-audit.spec.ts',
  'tests/phase7-files.spec.ts',
  'tests/phase8-organization-users.spec.ts',
  'tests/phase9-agents.spec.ts',
  'tests/phase10-vendors.spec.ts',
  'tests/phase12-policies.spec.ts',
  'tests/phase13-credentials-vault.spec.ts',
  'tests/phase15-workflow-runs.spec.ts',
  'tests/phase16-action-attempts.spec.ts',
  'tests/phase17-approvals.spec.ts',
  'tests/phase27-receipts.spec.ts'
] as const;

describe('security regression coverage inventory', () => {
  it('keeps cross-organization isolation covered for organization-scoped resources', () => {
    expect(crossOrganizationCoverage).toEqual([
      'tests/phase5-authorization.spec.ts',
      'tests/phase6-audit.spec.ts',
      'tests/phase7-files.spec.ts',
      'tests/phase8-organization-users.spec.ts',
      'tests/phase9-agents.spec.ts',
      'tests/phase10-vendors.spec.ts',
      'tests/phase12-policies.spec.ts',
      'tests/phase13-credentials-vault.spec.ts',
      'tests/phase15-workflow-runs.spec.ts',
      'tests/phase16-action-attempts.spec.ts',
      'tests/phase17-approvals.spec.ts',
      'tests/phase27-receipts.spec.ts'
    ]);
  });
});
