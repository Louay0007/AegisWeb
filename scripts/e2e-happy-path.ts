import { chromium } from 'playwright';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3001';
const email = process.env.E2E_EMAIL ?? 'founder@northstarlabs.dev';
const password = process.env.E2E_PASSWORD ?? 'Password123!';

type Envelope<T> = { data: T };
type WorkflowRun = { id: string; status: string };
type Approval = { id: string; workflowRunId: string; status: string };
type Receipt = { id: string; workflowRunId: string };

async function main() {
  await assertReady();

  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await loginInBrowser(page);

    const token = await page.evaluate(() => localStorage.getItem('aegisweb.access_token')) ?? await loginForApiToken();
    const sessionMode = await page.evaluate(() => {
      const raw = localStorage.getItem('aegisweb.session');
      return raw ? JSON.parse(raw).mode : null;
    });
    if (!token || sessionMode !== 'api') {
      throw new Error(`Expected API session, received mode=${sessionMode ?? 'missing'}.`);
    }
    await ensureBrowserSession(page, token);

    await page.goto(`${webUrl}/app/runs`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /start workflow/i }).first().click();
    await page.getByRole('button', { name: /Acme Downgrade Request/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /start run/i }).click();
    await waitForRunDetailPage(page);

    const runId = page.url().split('/app/runs/')[1]?.split(/[?#]/)[0];
    if (!runId) throw new Error('Could not read workflow run id from URL.');

    await waitForRunStatus(token, runId, (status) => status === 'waiting_for_approval', 75_000);
    const approval = await waitForApproval(token, runId, 30_000);

    await ensureBrowserSession(page, token);
    await page.goto(`${webUrl}/app/approvals/${approval.id}`, { waitUntil: 'domcontentloaded' });
    await waitForApprovalPage(page);
    await page.locator('#decision-comment').fill('Approved by the local Playwright happy path.');
    await page.getByRole('button', { name: /^Approve$/ }).first().click();
    await page.getByRole('button', { name: /approve action/i }).click();

    await waitForRunStatus(token, runId, (status) => status === 'completed', 90_000);
    const receipt = await waitForReceipt(token, runId, 30_000);

    await ensureBrowserSession(page, token);
    await page.goto(`${webUrl}/app/receipts/${receipt.id}`, { waitUntil: 'domcontentloaded' });
    await waitForReceiptPage(page);
    await page.getByText(/Integrity/i).first().waitFor({ timeout: 15_000 });

    await page.goto(`${webUrl}/app/audit`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /inspect/i }).first().click();
    await page.getByText(/Hash/i).first().waitFor({ timeout: 15_000 });

    console.log(`E2E happy path passed. Run ${runId}, approval ${approval.id}, receipt ${receipt.id}.`);
  } finally {
    await browser.close();
  }
}

async function loginInBrowser(page: import('playwright').Page) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForURL(/\/app\/home/, { timeout: 30_000, waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Browser login failed.');
}

async function assertReady() {
  const response = await fetch(`${apiUrl}/health/ready`);
  if (!response.ok) {
    throw new Error(`API is not ready at ${apiUrl}/health/ready. Start infra, API, worker, vendor, and web first.`);
  }
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-request-id': `e2e_${Date.now()}`,
    },
  });
  const json = (await response.json()) as Envelope<T> | { error?: { message?: string } };
  if (!response.ok || !('data' in json)) {
    throw new Error('error' in json ? json.error?.message ?? `API request failed: ${path}` : `API request failed: ${path}`);
  }
  return json.data;
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

async function ensureBrowserSession(page: import('playwright').Page, token: string) {
  await page.context().addCookies([
    {
      name: 'aegisweb_session',
      value: '1',
      url: `${webUrl}/app`,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60
    }
  ]);
  await page.evaluate((accessToken) => {
    localStorage.setItem('aegisweb.access_token', accessToken);
  }, token);
}

async function waitForRunStatus(token: string, runId: string, done: (status: string) => boolean, timeoutMs: number) {
  return poll(async () => {
    const run = await apiGet<WorkflowRun>(token, `/workflow-runs/${runId}`);
    if (done(run.status)) return run;
    if (['failed', 'denied', 'canceled'].includes(run.status)) {
      throw new Error(`Run ${runId} reached terminal failure state ${run.status}.`);
    }
    return null;
  }, timeoutMs, `workflow run ${runId}`);
}

async function waitForApproval(token: string, runId: string, timeoutMs: number) {
  return poll(async () => {
    const approvals = await apiGet<Approval[]>(token, '/approvals');
    return approvals.find((approval) => approval.workflowRunId === runId && approval.status === 'pending') ?? null;
  }, timeoutMs, `approval for run ${runId}`);
}

async function waitForApprovalPage(page: import('playwright').Page) {
  try {
    await waitForBodyText(page, 'Approval decision', 45_000);
  } catch (error) {
    const body = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    throw new Error(`Approval page did not become ready at ${page.url()}. Visible body: ${body}`, { cause: error });
  }
}

async function waitForRunDetailPage(page: import('playwright').Page) {
  try {
    await page.waitForURL(/\/app\/runs\/[^/]+/, { timeout: 45_000, waitUntil: 'domcontentloaded' });
  } catch (error) {
    const body = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    throw new Error(`Run detail page did not open after starting workflow at ${page.url()}. Visible body: ${body}`, { cause: error });
  }
}

async function waitForReceiptPage(page: import('playwright').Page) {
  try {
    await waitForBodyText(page, 'Receipt timeline', 45_000);
  } catch (error) {
    const body = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    throw new Error(`Receipt page did not become ready at ${page.url()}. Visible body: ${body}`, { cause: error });
  }
}

async function waitForBodyText(page: import('playwright').Page, text: string, timeoutMs: number) {
  await page.waitForFunction(
    (expected) => document.body.innerText.toLowerCase().includes(expected.toLowerCase()),
    text,
    { timeout: timeoutMs }
  );
}

async function waitForReceipt(token: string, runId: string, timeoutMs: number) {
  return poll(async () => {
    const receipts = await apiGet<Receipt[]>(token, `/receipts?workflowRunId=${runId}`);
    return receipts[0] ?? null;
  }, timeoutMs, `receipt for run ${runId}`);
}

async function poll<T>(fn: () => Promise<T | null>, timeoutMs: number, label: string): Promise<T> {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${label}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
