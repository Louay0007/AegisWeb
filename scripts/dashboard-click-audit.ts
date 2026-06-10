import { chromium, type Page } from 'playwright';
import { pathToFileURL } from 'node:url';
import { hasBlockingFindings, type QaFinding, writeQaReport } from './qa-utils.js';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3001';
const email = process.env.E2E_EMAIL ?? 'founder@northstarlabs.dev';
const password = process.env.E2E_PASSWORD ?? 'Password123!';

type Envelope<T> = { data: T };
type IdRecord = { id: string };
type RunRecord = IdRecord & { status: string; receipt?: { id: string } | null; approvalRequests?: IdRecord[] };
type ReceiptRecord = IdRecord & { workflowRunId: string };

export async function runDashboardClickAudit() {
  const findings: QaFinding[] = [];
  await assertReady();

  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      findings.push({ severity: text.includes('Failed to load resource') ? 'low' : 'medium', area: 'console', message: text });
    }
  });

  try {
    await login(page);
    const token = await readToken(page);
    const ids = await loadRepresentativeIds(token);

    const routes = [
      '/app/agents',
      '/app/vendors',
      '/app/credentials',
      '/app/policies',
      '/app/workflows',
      '/app/settings',
      ids.runId ? `/app/runs/${ids.runId}` : '/app/runs',
      ids.receiptId ? `/app/receipts/${ids.receiptId}` : '/app/receipts',
      '/app/audit'
    ];

    for (const route of routes) {
      await auditRoute(page, route, findings);
    }

    await auditAgentCreate(page, token, findings);
    await auditSettingsInviteValidation(page, findings);
    await auditAuditDrawer(page, findings);
    await auditReceiptEvidence(page, ids.receiptId, findings);
  } finally {
    await browser.close();
  }

  const report = await writeQaReport('click-path-audit.md', 'AegisWeb Click-Path Audit', findings);
  console.log(`Click-path audit report: ${report}`);
  if (hasBlockingFindings(findings)) process.exitCode = 1;
}

async function login(page: Page) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForURL(/\/app\/home/, { timeout: 30_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Browser login failed.');
}

async function auditRoute(page: Page, route: string, findings: QaFinding[]) {
  await page.goto(`${webUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  const bodyText = (await page.locator('body').innerText().catch(() => '')).trim();
  if (bodyText.length < 40) {
    findings.push({ severity: 'high', area: route, message: 'Page rendered as blank or nearly blank.' });
  }
  const disabledWithoutReason = await page
    .locator('button[disabled]')
    .evaluateAll((buttons) => buttons.filter((button) => !button.getAttribute('title') && !button.getAttribute('aria-label')).length)
    .catch(() => 0);
  if (disabledWithoutReason > 0) {
    findings.push({ severity: 'low', area: route, message: `${disabledWithoutReason} disabled button(s) lack a title or aria-label explanation.` });
  }
}

async function auditAgentCreate(page: Page, token: string, _findings: QaFinding[]) {
  await page.goto(`${webUrl}/app/agents`, { waitUntil: 'domcontentloaded' });
  const suffix = Date.now().toString(36);
  const created = await apiPost<{ id: string }>(token, '/agents', {
    name: `QA Agent ${suffix}`,
    purpose: 'Created by click-path audit.'
  });
  await apiGet(token, `/agents/${created.id}`);
}

async function auditSettingsInviteValidation(page: Page, findings: QaFinding[]) {
  await page.goto(`${webUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
  const inviteButton = page.getByRole('button', { name: /invite user/i });
  if (!(await inviteButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
    findings.push({ severity: 'low', area: '/app/settings invite validation', message: 'Invite user action is not present on settings.' });
    return;
  }
  await inviteButton.click();
  await page.getByRole('button', { name: /^invite$/i }).click();
  await expectText(page, /valid email|enter a name/i, '/app/settings invite validation', findings);
}

async function auditAuditDrawer(page: Page, findings: QaFinding[]) {
  await page.goto(`${webUrl}/app/audit`, { waitUntil: 'domcontentloaded' });
  const inspectButton = page.getByRole('button', { name: /inspect/i }).first();
  if (!(await inspectButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
    findings.push({ severity: 'low', area: '/app/audit drawer', message: 'No audit inspect action was visible.' });
    return;
  }
  await inspectButton.click();
  await expectText(page, /redacted payload/i, '/app/audit drawer', findings);
  await expectText(page, /open run|event metadata/i, '/app/audit related links', findings);
}

async function auditReceiptEvidence(page: Page, receiptId: string | null, findings: QaFinding[]) {
  if (!receiptId) return;
  await page.goto(`${webUrl}/app/receipts/${receiptId}`, { waitUntil: 'domcontentloaded' });
  const openButton = page.getByRole('button', { name: /^open$/i }).first();
  if (!(await openButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
    findings.push({ severity: 'low', area: '/app/receipts screenshot dialog', message: 'No receipt evidence open action was visible.' });
    return;
  }
  await openButton.click();
  await expectText(page, /sensitive browser evidence|loading evidence image|screenshot image unavailable|masked sensitive/i, '/app/receipts screenshot dialog', findings);
}

async function expectText(page: Page, pattern: RegExp, area: string, findings: QaFinding[]) {
  try {
    await page.getByText(pattern).first().waitFor({ timeout: 10_000 });
  } catch {
    findings.push({ severity: 'high', area, message: `Expected visible text matching ${pattern}.` });
  }
}

async function readToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('aegisweb.access_token'));
  return token ?? loginForApiToken();
}

async function loginForApiToken(): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const json = (await response.json()) as Envelope<{ accessToken: string }> | { error?: { message?: string } };
  if (!response.ok || !('data' in json)) {
    throw new Error('error' in json ? json.error?.message ?? 'API login failed.' : 'API login failed.');
  }
  return json.data.accessToken;
}

async function loadRepresentativeIds(token: string) {
  const runs = await apiGet<RunRecord[]>(token, '/workflow-runs');
  const receipts = await apiGet<ReceiptRecord[]>(token, '/receipts');
  const run = runs.find((item) => item.receipt || item.approvalRequests?.length) ?? runs[0];
  const receipt = receipts.find((item) => item.workflowRunId === run?.id) ?? receipts[0];
  return { runId: run?.id ?? null, receiptId: receipt?.id ?? null };
}

async function apiGet<T>(token: string, path: string) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { authorization: `Bearer ${token}`, 'x-request-id': `qa_${Date.now()}` }
  });
  const json = (await response.json()) as Envelope<T>;
  if (!response.ok) throw new Error(`API request failed: ${path}`);
  return json.data;
}

async function apiPost<T>(token: string, path: string, body: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-request-id': `qa_${Date.now()}`
    },
    body: JSON.stringify(body)
  });
  const json = (await response.json()) as Envelope<T>;
  if (!response.ok) throw new Error(`API request failed: ${path}`);
  return json.data;
}

async function assertReady() {
  const response = await fetch(`${apiUrl}/health/ready`);
  if (!response.ok) throw new Error(`API is not ready at ${apiUrl}/health/ready.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runDashboardClickAudit().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
