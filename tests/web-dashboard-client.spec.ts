import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../apps/web/lib/api/api-client.js';
import { ApiError } from '../apps/web/lib/api/api-errors.js';
import { mapReceipt, mapWorkflowRun } from '../apps/web/lib/api/mappers.js';
import { relatedAuditLinks } from '../apps/web/lib/audit/audit-links.js';
import { isDownloadableImageEvidence, screenshotDownloadName } from '../apps/web/lib/evidence/screenshot-evidence.js';
import { actionDisabledReason } from '../apps/web/lib/permissions/action-disabled-reason.js';
import { can } from '../apps/web/lib/permissions/permissions.js';
import { hasBlockingFindings, qaMarkdown } from '../scripts/qa-utils.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('web dashboard API client', () => {
  it('normalizes API errors with request IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'PERMISSION_DENIED', message: 'Forbidden.', requestId: 'req_test' } }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    await expect(apiGet('/agents')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Forbidden.',
      requestId: 'req_test',
      status: 403
    } satisfies Partial<ApiError>);
  });

  it('refreshes once on 401 and retries the original request', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Expired.' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { accessToken: 'fresh-token' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'agent-1' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet<Array<{ id: string }>>('/agents')).resolves.toEqual([{ id: 'agent-1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(storage.get('aegisweb.access_token')).toBe('fresh-token');
  });
});

describe('web dashboard mappers', () => {
  it('preserves workflow run detail evidence', () => {
    const run = mapWorkflowRun({
      id: 'run-1',
      workflowId: 'wf-1',
      agentId: 'agent-1',
      vendorId: 'vendor-1',
      status: 'waiting_for_approval',
      startedAt: '2026-06-08T10:00:00.000Z',
      currentStep: 'Waiting for approval',
      resultSummary: null,
      errorMessage: null,
      createdAt: '2026-06-08T10:00:00.000Z',
      updatedAt: '2026-06-08T10:00:05.000Z',
      workflow: { id: 'wf-1', name: 'Acme Downgrade', template: 'plan_downgrade_request' },
      agent: { id: 'agent-1', name: 'Finance Agent', identifier: 'finance@aegisweb.local' },
      vendor: { id: 'vendor-1', name: 'Acme', website: 'https://acme.test' },
      files: [{ id: 'file-1', kind: 'screenshot', mimeType: 'image/png', sizeBytes: 1024, sha256: 'abc123', createdAt: '2026-06-08T10:00:03.000Z' }],
      actionAttempts: [{ id: 'attempt-1', riskLevel: 'high', policyDecision: 'require_approval', policyReason: 'Amount requires approval.', inputSummary: 'Downgrade plan', amountCents: 1800000, createdAt: '2026-06-08T10:00:02.000Z' }],
      approvalRequests: [{ id: 'approval-1', status: 'pending', summary: 'Approve downgrade', riskLevel: 'high', amountCents: 1800000, createdAt: '2026-06-08T10:00:04.000Z' }],
      receipt: { id: 'receipt-1', finalStatus: 'completed', summary: 'Done', createdAt: '2026-06-08T10:01:00.000Z' }
    });

    expect(run.status).toBe('waiting');
    expect(run.files[0]).toMatchObject({ id: 'file-1', downloadHref: '/files/file-1/download' });
    expect(run.evidence?.screenshots?.[0]).toMatchObject({ fileId: 'file-1', mimeType: 'image/png', downloadHref: '/files/file-1/download' });
    expect(run.evidence?.approvals?.[0]).toMatchObject({ id: 'approval-1', risk: 'high' });
    expect(run.evidence?.receipt?.id).toBe('receipt-1');
  });

  it('maps receipt detail timeline, screenshots, files, and approval details', () => {
    const receipt = mapReceipt({
      id: 'receipt-1',
      organizationId: 'org-1',
      workflowRunId: 'run-1',
      agentId: 'agent-1',
      finalStatus: 'completed',
      summary: 'Receipt generated.',
      agent: { id: 'agent-1', name: 'Finance Agent', identifier: 'finance@aegisweb.local' },
      workflowRun: { id: 'run-1', status: 'completed', currentStep: 'Done' },
      createdAt: '2026-06-08T10:02:00.000Z',
      workflow: { id: 'wf-1', name: 'Acme Downgrade', template: 'plan_downgrade_request' },
      vendor: { id: 'vendor-1', name: 'Acme', website: 'https://acme.test' },
      timeline: [{ type: 'file', id: 'file-1', at: '2026-06-08T10:01:00.000Z', kind: 'SCREENSHOT', sha256: 'abc123' }],
      screenshots: [{ id: 'file-1', kind: 'SCREENSHOT', objectKey: 'org/run/screenshot.png', mimeType: 'image/png', sizeBytes: 1024, sha256: 'abc123', createdAt: '2026-06-08T10:01:00.000Z' }],
      files: [{ id: 'file-1', kind: 'SCREENSHOT', objectKey: 'org/run/screenshot.png', mimeType: 'image/png', sizeBytes: 1024, sha256: 'abc123', createdAt: '2026-06-08T10:01:00.000Z' }],
      policyDecisions: [{ policyDecision: 'approval_required' }],
      approvalDetails: { approvals: [{ id: 'approval-1', status: 'approved', summary: 'Approved', amountCents: 1800000 }] }
    });

    expect(receipt.hash).toBe('abc123');
    expect(receipt.files[0]).toMatchObject({ label: 'screenshot.png', downloadHref: '/files/file-1/download' });
    expect(receipt.evidence?.screenshots?.[0]).toMatchObject({ fileId: 'file-1', mimeType: 'image/png', sha256: 'abc123' });
    expect(receipt.evidence?.timeline?.[0]?.events[0]?.hash).toBe('abc123');
    expect(receipt.evidence?.approvals?.[0]).toMatchObject({ id: 'approval-1', status: 'approved' });
  });
});

describe('web dashboard evidence helpers', () => {
  it('detects downloadable screenshots and produces stable filenames', () => {
    expect(isDownloadableImageEvidence({ id: 'file-1', title: 'Billing View', mimeType: 'image/png', downloadHref: '/files/file-1/download' })).toBe(true);
    expect(isDownloadableImageEvidence({ id: 'file-2', title: 'Receipt JSON', mimeType: 'application/json', downloadHref: '/files/file-2/download' })).toBe(false);
    expect(screenshotDownloadName({ id: 'file-1', title: 'Billing View', mimeType: 'image/png' })).toBe('billing-view.png');
  });

  it('extracts nested audit links for run, receipt, and approval IDs', () => {
    expect(
      relatedAuditLinks({
        workflowRun: 'run-1',
        payload: {
          receiptId: 'receipt-1',
          nested: { approvalRequestId: 'approval-1', runId: 'run-2' }
        }
      })
    ).toEqual([
      { label: 'Open run', href: '/app/runs/run-1' },
      { label: 'Open receipt', href: '/app/receipts/receipt-1' },
      { label: 'Open approval', href: '/app/approvals/approval-1' },
      { label: 'Open run', href: '/app/runs/run-2' }
    ]);
  });

  it('returns specific disabled-action messaging', () => {
    expect(actionDisabledReason(false, 'create agents', false)).toBe('Connect to the backend API to create agents.');
    expect(actionDisabledReason(true, 'grant credentials', false)).toBe('Your role cannot grant credentials.');
    expect(actionDisabledReason(true, 'grant credentials', true)).toBeUndefined();
  });

  it('summarizes QA blocking findings', () => {
    const findings = [{ severity: 'high' as const, area: 'settings', message: 'Dialog overflow.' }];
    expect(hasBlockingFindings(findings)).toBe(true);
    expect(qaMarkdown('QA', findings)).toContain('Verdict: FAIL');
  });
});

describe('web dashboard permissions', () => {
  it('matches the minimum role matrix', () => {
    expect(can('OWNER', 'credential:create')).toBe(true);
    expect(can('APPROVER', 'approval:approve')).toBe(true);
    expect(can('APPROVER', 'credential:create')).toBe(false);
    expect(can('AUDITOR', 'audit:read')).toBe(true);
    expect(can('AUDITOR', 'approval:approve')).toBe(false);
    expect(can('DEVELOPER', 'workflow:run')).toBe(true);
    expect(can('DEVELOPER', 'credential:grant')).toBe(false);
  });
});
