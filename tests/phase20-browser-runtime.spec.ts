import { createServer, Server } from 'node:http';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActionType, DomainError } from '@agentpass/domain';
import {
  createControlledContext,
  getBrowserRuntimeStatus,
  ControlledBrowserContext
} from '@agentpass/browser-runtime';

describe('phase 20 browser runtime library', () => {
  let server: Server;
  let baseUrl: string;
  let artifactDir: string;

  beforeAll(async () => {
    artifactDir = await mkdtemp(join(tmpdir(), 'agentpass-browser-runtime-'));
    server = createServer((request, response) => {
      if (request.url === '/login') {
        response.setHeader('content-type', 'text/html');
        response.end(`<!doctype html>
          <html>
            <head><title>Runtime Login</title></head>
            <body>
              <main>
                <h1>Acme Analytics</h1>
                <form action="/billing" method="post">
                  <label>Email <input id="email" name="email" type="email" /></label>
                  <label>Password <input id="password" name="password" type="password" /></label>
                  <button id="submit" type="button" onclick="document.body.dataset.clicked='yes'">Continue</button>
                </form>
                <a id="invoice" href="/invoice.pdf" download="invoice.pdf">Download invoice</a>
              </main>
            </body>
          </html>`);
        return;
      }

      if (request.url === '/invoice.pdf') {
        response.setHeader('content-type', 'application/pdf');
        response.setHeader('content-disposition', 'attachment; filename="invoice.pdf"');
        response.end('AgentPass phase 20 invoice');
        return;
      }

      response.statusCode = 404;
      response.end('not found');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(artifactDir, { recursive: true, force: true });
  });

  it('reports a ready Playwright controlled runtime', () => {
    expect(getBrowserRuntimeStatus()).toEqual({
      ready: true,
      runtime: 'playwright-controlled-runtime'
    });
  });

  it('allows navigation to the local sandbox domain and extracts DOM metadata', async () => {
    const context = await contextFor(['127.0.0.1']);

    try {
      const result = await context.navigateWithPolicy(`${baseUrl}/login`);
      expect(result).toMatchObject({
        requestedUrl: `${baseUrl}/login`,
        finalUrl: `${baseUrl}/login`,
        title: 'Runtime Login'
      });

      const dom = await context.extractDomMetadata();
      expect(dom).toMatchObject({
        url: `${baseUrl}/login`,
        title: 'Runtime Login',
        headings: ['Acme Analytics']
      });
      expect(dom.forms[0]?.inputNames).toEqual(['email', 'password']);
    } finally {
      await context.closeContext();
    }
  });

  it('blocks navigation to unknown domains and closes context on error', async () => {
    const context = await contextFor(['localhost']);

    await expect(context.navigateWithPolicy(`${baseUrl}/login`)).rejects.toBeInstanceOf(DomainError);
    await expect(context.captureScreenshot('after-blocked-navigation')).rejects.toThrow(/already closed/);
  });

  it('blocks private network navigation unless explicitly allowed', async () => {
    const context = await createControlledContext({
      workflowRunId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      allowedDomains: ['127.0.0.1'],
      artifactDir,
      timeoutMs: 5000,
      headless: true
    });

    await expect(context.navigateWithPolicy(`${baseUrl}/login`)).rejects.toBeInstanceOf(DomainError);
  });

  it('creates screenshots and marks password fields as masked before capture', async () => {
    const context = await contextFor(['127.0.0.1']);

    try {
      await context.navigateWithPolicy(`${baseUrl}/login`);
      await context.fillCredentialField('#password', 'phase20-secret-password');
      const screenshot = await context.captureScreenshot('masked-password');

      await expect(stat(screenshot.path)).resolves.toMatchObject({
        size: expect.any(Number)
      });
      await expect(context.page.locator('#password').getAttribute('data-agentpass-masked')).resolves.toBe('true');
    } finally {
      await context.closeContext();
    }
  });

  it('captures before and after screenshots around sensitive clicks', async () => {
    const context = await contextFor(['127.0.0.1']);

    try {
      await context.navigateWithPolicy(`${baseUrl}/login`);
      const before = new Set(await readdir(artifactDir));

      await context.clickWithActionAttempt('#submit', {
        actionType: ActionType.SubmitForm,
        label: 'sensitive-submit',
        sensitive: true
      });

      const after = await readdir(artifactDir);
      const added = after.filter((file) => !before.has(file) && file.includes('sensitive-submit'));
      expect(added.length).toBe(2);
      await expect(context.page.locator('body').getAttribute('data-clicked')).resolves.toBe('yes');
    } finally {
      await context.closeContext();
    }
  });

  it('captures downloads with file metadata only during allowed download steps', async () => {
    const context = await contextFor(['127.0.0.1']);

    try {
      await context.navigateWithPolicy(`${baseUrl}/login`);
      await expect(
        context.downloadWithCapture('#invoice', {
          actionType: ActionType.ReadPage,
          label: 'blocked-download'
        })
      ).rejects.toBeInstanceOf(DomainError);

      const download = await context.downloadWithCapture('#invoice', {
        actionType: ActionType.DownloadFile,
        label: 'latest-invoice',
        allowDownload: true
      });

      expect(download).toMatchObject({
        label: 'latest-invoice',
        suggestedFilename: 'invoice.pdf',
        sizeBytes: 'AgentPass phase 20 invoice'.length,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
      });
      await expect(stat(download.path)).resolves.toMatchObject({
        size: 'AgentPass phase 20 invoice'.length
      });
    } finally {
      await context.closeContext();
    }
  });

  async function contextFor(allowedDomains: string[]): Promise<ControlledBrowserContext> {
    return createControlledContext({
      workflowRunId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      allowedDomains,
      artifactDir,
      timeoutMs: 5000,
      headless: true,
      allowPrivateNetwork: true
    });
  }
});
