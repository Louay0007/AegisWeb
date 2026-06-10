import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTION_RISK_DEFAULTS,
  ACTION_TYPES,
  AGENT_STATUSES,
  APPROVAL_STATUSES,
  ActionType,
  AuditEventType,
  AUDIT_EVENT_TYPES,
  canTransitionWorkflowRun,
  createPageMeta,
  CredentialType,
  FILE_KINDS,
  hasPermission,
  normalizePageRequest,
  Permission,
  PERMISSIONS,
  RECEIPT_STATUSES,
  RiskLevel,
  ROLE_PERMISSIONS,
  USER_ROLES,
  UserRole,
  WorkflowRunStatus,
  WORKFLOW_TEMPLATE_DEFINITIONS,
  WORKFLOW_TEMPLATES
} from '@agentpass/domain';

describe('phase 2 domain library', () => {
  it('exposes stable enum values for API/domain contracts', () => {
    expect(USER_ROLES).toEqual(['owner', 'admin', 'approver', 'auditor', 'developer']);
    expect(AGENT_STATUSES).toEqual(['active', 'paused', 'revoked']);
    expect(WORKFLOW_TEMPLATES).toEqual([
      'vendor_invoice_download',
      'saas_renewal_check',
      'plan_downgrade_request'
    ]);
    expect(APPROVAL_STATUSES).toEqual([
      'pending',
      'approved',
      'rejected',
      'expired',
      'auto_approved',
      'escalated'
    ]);
    expect(FILE_KINDS).toEqual([
      'screenshot',
      'invoice',
      'playwright_trace',
      'receipt_export',
      'download'
    ]);
    expect(RECEIPT_STATUSES).toEqual(['completed', 'failed', 'denied', 'canceled']);
    expect(CredentialType.UsernamePassword).toBe('username_password');
    expect(AuditEventType.CredentialUsed).toBe('credential_used');
    expect(AUDIT_EVENT_TYPES).toContain('receipt_created');
  });

  it('defines permission coverage for every role', () => {
    for (const role of USER_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }

    expect(hasPermission(UserRole.Owner, Permission.CredentialCreate)).toBe(true);
    expect(hasPermission(UserRole.Approver, Permission.ApprovalApprove)).toBe(true);
    expect(hasPermission(UserRole.Approver, Permission.CredentialCreate)).toBe(false);
    expect(hasPermission(UserRole.Auditor, Permission.AuditRead)).toBe(true);
    expect(hasPermission(UserRole.Auditor, Permission.ApprovalApprove)).toBe(false);
    expect(hasPermission(UserRole.Developer, Permission.WorkflowRun)).toBe(true);

    for (const permission of PERMISSIONS) {
      expect(ROLE_PERMISSIONS[UserRole.Owner]).toContain(permission);
    }
  });

  it('defines known required inputs and expected actions for every workflow template', () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const definition = WORKFLOW_TEMPLATE_DEFINITIONS[template];

      expect(definition.template).toBe(template);
      expect(definition.displayName.length).toBeGreaterThan(3);
      expect(definition.requiredInputs.some((input) => input.name === 'vendorId')).toBe(true);
      expect(definition.expectedActions).toContain(ActionType.OpenPage);
      expect(definition.producesReceipt).toBe(true);
    }

    expect(WORKFLOW_TEMPLATE_DEFINITIONS.plan_downgrade_request.requiredInputs).toContainEqual({
      name: 'targetPlan',
      required: true,
      description: 'Plan the agent will propose.'
    });
  });

  it('maps every action type to a default risk level', () => {
    expect(Object.keys(ACTION_RISK_DEFAULTS).sort()).toEqual([...ACTION_TYPES].sort());
    expect(ACTION_RISK_DEFAULTS[ActionType.ReadPage]).toBe(RiskLevel.Low);
    expect(ACTION_RISK_DEFAULTS[ActionType.CredentialInjection]).toBe(RiskLevel.Medium);
    expect(ACTION_RISK_DEFAULTS[ActionType.ChangePlan]).toBe(RiskLevel.High);
    expect(ACTION_RISK_DEFAULTS[ActionType.CancelSubscription]).toBe(RiskLevel.Critical);
    expect(ACTION_RISK_DEFAULTS[ActionType.ChangeBillingDetails]).toBe(RiskLevel.Critical);
  });

  it('defines workflow run transitions centrally', () => {
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Queued, WorkflowRunStatus.Running)).toBe(true);
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Running, WorkflowRunStatus.WaitingForApproval)).toBe(true);
    expect(canTransitionWorkflowRun(WorkflowRunStatus.WaitingForApproval, WorkflowRunStatus.Running)).toBe(true);
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Completed, WorkflowRunStatus.Running)).toBe(false);
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Denied, WorkflowRunStatus.Running)).toBe(false);
  });

  it('normalizes pagination contracts', () => {
    const request = normalizePageRequest({ page: -10, pageSize: 1000 });
    expect(request).toEqual({ page: 1, pageSize: 100 });
    expect(createPageMeta(request, 250)).toEqual({
      page: 1,
      pageSize: 100,
      totalItems: 250,
      totalPages: 3
    });
  });

  it('has no dependencies on framework, ORM, browser, or storage libraries', () => {
    const domainDir = join(process.cwd(), 'libs/domain/src');
    const forbidden = [
      '@nestjs/',
      '@prisma/',
      'playwright',
      'ioredis',
      '@angular/',
      '@aws-sdk/'
    ];

    for (const file of readdirSync(domainDir).filter((entry) => entry.endsWith('.ts'))) {
      const source = readFileSync(join(domainDir, file), 'utf8');
      const imports = source
        .split('\n')
        .filter((line) => line.trim().startsWith('import '))
        .join('\n');

      for (const pattern of forbidden) {
        expect(imports, `${file} should not import ${pattern}`).not.toContain(pattern);
      }
    }
  });
});
