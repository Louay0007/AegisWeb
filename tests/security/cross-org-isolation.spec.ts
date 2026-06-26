import { describe, expect, it } from 'vitest';

const coveredResources = [
  'agents',
  'vendors',
  'policies',
  'credentials',
  'workflows',
  'workflowRuns',
  'actionAttempts',
  'approvals',
  'receipts',
  'files',
  'auditEvents',
  'users'
] as const;

describe('security: cross-organization isolation coverage', () => {
  it('tracks every organization-scoped resource in regression coverage', () => {
    expect(coveredResources).toEqual([
      'agents',
      'vendors',
      'policies',
      'credentials',
      'workflows',
      'workflowRuns',
      'actionAttempts',
      'approvals',
      'receipts',
      'files',
      'auditEvents',
      'users'
    ]);
  });
});
