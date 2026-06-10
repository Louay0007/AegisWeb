import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import { hasBlockingFindings, QA_ARTIFACT_DIR, type QaFinding, writeQaReport } from './qa-utils.js';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3001';
const email = process.env.E2E_EMAIL ?? 'founder@northstarlabs.dev';
const password = process.env.E2E_PASSWORD ?? 'Password123!';

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

type Envelope<T> = { data: T };
type RunRecord = { id: string; approvalRequests?: Array<{ id: string }>; receipt?: { id: string } | null };
type ReceiptRecord = { id: string; workflowRunId: string };

export async function runResponsiveQa() {
  const findings: QaFinding[] = [];
  await assertReady();
  await mkdir(join(QA_ARTIFACT_DIR, 'responsive'), { recursive: true });

  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const page = await browser.newPage();

  try {
    await login(page);
    const token = await readToken(page);
    const ids = await loadRepresentativeIds(token);
    const routes = [
      '/login',
      '/app/home',
      '/app/agents',
      '/app/vendors',
      '/app/credentials',
      '/app/policies',
      '/app/workflows',
      '/app/settings',
      ids.runId ? `/app/runs/${ids.runId}` : '/app/runs',
      ids.approvalId ? `/app/approvals/${ids.approvalId}` : '/app/approvals',
      ids.receiptId ? `/app/receipts/${ids.receiptId}` : '/app/receipts',
      '/app/audit'
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        await inspectRoute(page, route, viewport.name, findings);
      }
      await inspectAuditDrawer(page, viewport.name, findings);
      await inspectStartWorkflowDialog(page, viewport.name, findings);
    }
  } finally {
    await browser.close();
  }

  const report = await writeQaReport('responsive-qa.md', 'AegisWeb Responsive QA', findings);
  console.log(`Responsive QA report: ${report}`);
  if (hasBlockingFindings(findings)) process.exitCode = 1;
}

async function inspectRoute(page: Page, route: string, viewport: string, findings: QaFinding[]) {
  await page.goto(`${webUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) {
    findings.push({ severity: 'high', area: `${viewport} ${route}`, message: 'Horizontal overflow detected.' });
  }

  const bodyText = (await page.locator('body').innerText().catch(() => '')).trim();
  if (bodyText.length < 40) {
    findings.push({ severity: 'high', area: `${viewport} ${route}`, message: 'Page rendered blank or nearly blank.' });
  }

  await page.screenshot({ path: join(QA_ARTIFACT_DIR, 'responsive', `${viewport}-${safeName(route)}.png`), fullPage: true });
}

async function inspectAuditDrawer(page: Page, viewport: string, findings: QaFinding[]) {
  await page.goto(`${webUrl}/app/audit`, { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: /inspect/i }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.click();
  await page.getByText(/redacted payload/i).first().waitFor({ timeout: 10_000 }).catch(() => {
    findings.push({ severity: 'high', area: `${viewport} audit drawer`, message: 'Audit drawer did not expose payload inspection.' });
  });
}

async function inspectStartWorkflowDialog(page: Page, viewport: string, findings: QaFinding[]) {
  await page.goto(`${webUrl}/app/runs`, { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: /start workflow/i }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.click();
  await page.getByText(/start controlled workflow/i).first().waitFor({ timeout: 10_000 }).catch(() => {
    findings.push({ severity: 'high', area: `${viewport} start workflow`, message: 'Start workflow dialog did not open.' });
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) {
    findings.push({ severity: 'high', area: `${viewport} start workflow`, message: 'Dialog causes horizontal overflow.' });
  }
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
  const run = runs.find((item) => item.approvalRequests?.length || item.receipt) ?? runs[0];
  const receipt = receipts.find((item) => item.workflowRunId === run?.id) ?? receipts[0];
  return {
    runId: run?.id ?? null,
    approvalId: run?.approvalRequests?.[0]?.id ?? null,
    receiptId: receipt?.id ?? null
  };
}

async function apiGet<T>(token: string, path: string) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { authorization: `Bearer ${token}`, 'x-request-id': `qa_${Date.now()}` }
  });
  const json = (await response.json()) as Envelope<T>;
  if (!response.ok) throw new Error(`API request failed: ${path}`);
  return json.data;
}

async function assertReady() {
  const response = await fetch(`${apiUrl}/health/ready`);
  if (!response.ok) throw new Error(`API is not ready at ${apiUrl}/health/ready.`);
}

function safeName(route: string) {
  return route.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/g, '') || 'root';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runResponsiveQa().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
