import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { join } from 'node:path';
import { ActionType, DomainError, DomainErrorCode } from '@agentpass/domain';
import { Browser, BrowserContext, Download, Page, chromium } from 'playwright';

export type BrowserRuntimeStatus = {
  ready: true;
  runtime: 'playwright-controlled-runtime';
};

export type BrowserRunContext = {
  workflowRunId: string;
  organizationId: string;
  allowedDomains: string[];
  artifactDir: string;
  timeoutMs?: number;
  headless?: boolean;
  allowPrivateNetwork?: boolean;
};

export type BrowserActionMetadata = {
  actionType: ActionType;
  label: string;
  sensitive?: boolean;
  allowDownload?: boolean;
};

export type NavigationResult = {
  requestedUrl: string;
  finalUrl: string;
  title: string;
};

export type ScreenshotCapture = {
  label: string;
  path: string;
  url: string;
  capturedAt: string;
};

export type DownloadCapture = {
  label: string;
  suggestedFilename: string;
  path: string;
  sizeBytes: number;
  sha256: string;
  url: string;
  capturedAt: string;
};

export type DomMetadata = {
  url: string;
  title: string;
  headings: string[];
  forms: Array<{
    action: string;
    method: string;
    inputNames: string[];
  }>;
  links: Array<{
    text: string;
    href: string;
  }>;
};

export type ControlledBrowserContext = {
  navigateWithPolicy(url: string): Promise<NavigationResult>;
  fillCredentialField(selector: string, value: string): Promise<void>;
  clickWithActionAttempt(selector: string, actionMetadata: BrowserActionMetadata): Promise<void>;
  downloadWithCapture(selector: string, actionMetadata: BrowserActionMetadata): Promise<DownloadCapture>;
  captureScreenshot(label: string): Promise<ScreenshotCapture>;
  extractDomMetadata(): Promise<DomMetadata>;
  closeContext(): Promise<void>;
  page: Page;
};

export function getBrowserRuntimeStatus(): BrowserRuntimeStatus {
  return {
    ready: true,
    runtime: 'playwright-controlled-runtime'
  };
}

export async function createControlledContext(runContext: BrowserRunContext): Promise<ControlledBrowserContext> {
  return ControlledPlaywrightContext.create(runContext);
}

class ControlledPlaywrightContext implements ControlledBrowserContext {
  readonly page: Page;
  private readonly browser: Browser;
  private readonly context: BrowserContext;
  private readonly timeoutMs: number;
  private readonly blockedPopupUrls: string[] = [];
  private closed = false;

  private constructor(browser: Browser, context: BrowserContext, page: Page, private readonly runContext: BrowserRunContext) {
    this.browser = browser;
    this.context = context;
    this.page = page;
    this.timeoutMs = runContext.timeoutMs ?? 10000;
    this.page.setDefaultTimeout(this.timeoutMs);
    this.page.setDefaultNavigationTimeout(this.timeoutMs);
  }

  static async create(runContext: BrowserRunContext): Promise<ControlledPlaywrightContext> {
    await mkdir(runContext.artifactDir, { recursive: true });

    const browser = await chromium.launch({ headless: runContext.headless ?? true });
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();
    const controlled = new ControlledPlaywrightContext(browser, context, page, runContext);

    controlled.installPopupGuard(page);
    context.on('page', (newPage) => controlled.installPopupGuard(newPage));
    await context.route('**/*', async (route) => {
      const request = route.request();
      try {
        await controlled.assertAllowedNetworkUrl(request.url());
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    return controlled;
  }

  async navigateWithPolicy(url: string): Promise<NavigationResult> {
    this.assertOpen();

    try {
      await this.assertAllowedNetworkUrl(url);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs });
      await this.assertAllowedNetworkUrl(this.page.url());

      return {
        requestedUrl: url,
        finalUrl: this.page.url(),
        title: await this.page.title()
      };
    } catch (error) {
      await this.closeContext();
      throw error;
    }
  }

  async fillCredentialField(selector: string, value: string): Promise<void> {
    this.assertOpen();

    await this.page.locator(selector).fill(value, { timeout: this.timeoutMs });
    await this.page.locator(selector).evaluate((element) => {
      element.setAttribute('data-agentpass-secret', 'true');
      element.setAttribute('autocomplete', 'off');
    });
  }

  async clickWithActionAttempt(selector: string, actionMetadata: BrowserActionMetadata): Promise<void> {
    this.assertOpen();

    if (actionMetadata.sensitive) {
      await this.captureScreenshot(`${actionMetadata.label}-before`);
    }

    const blockedBefore = this.blockedPopupUrls.length;
    await this.page.locator(selector).click({ timeout: this.timeoutMs });
    await this.page.waitForTimeout(100);
    this.assertNoNewBlockedPopup(blockedBefore);
    await this.assertAllowedNetworkUrl(this.page.url());

    if (actionMetadata.sensitive) {
      await this.captureScreenshot(`${actionMetadata.label}-after`);
    }
  }

  async downloadWithCapture(selector: string, actionMetadata: BrowserActionMetadata): Promise<DownloadCapture> {
    this.assertOpen();

    if (!actionMetadata.allowDownload || actionMetadata.actionType !== ActionType.DownloadFile) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Download is only allowed during approved download steps.');
    }

    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: this.timeoutMs }),
      this.page.locator(selector).click({ timeout: this.timeoutMs })
    ]);

    await this.assertAllowedNetworkUrl(this.page.url());
    return this.saveDownload(download, actionMetadata.label);
  }

  async captureScreenshot(label: string): Promise<ScreenshotCapture> {
    this.assertOpen();
    await this.maskPasswordFields();

    const capturedAt = new Date().toISOString();
    const path = join(this.runContext.artifactDir, `${Date.now()}-${sanitizeFilePart(label)}.png`);
    await this.page.screenshot({
      path,
      fullPage: true,
      timeout: this.timeoutMs
    });

    return {
      label,
      path,
      url: this.page.url(),
      capturedAt
    };
  }

  async extractDomMetadata(): Promise<DomMetadata> {
    this.assertOpen();

    return this.page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        location: { href: string };
        document: {
          title: string;
          querySelectorAll(selector: string): Iterable<{
            textContent: string | null;
            href?: string;
          }>;
          forms: Iterable<{
            action: string;
            method: string;
            querySelectorAll(selector: string): Iterable<{
              name: string;
              id: string;
              type: string;
            }>;
          }>;
        };
      };
      const { document, location } = browserGlobal;

      return {
        url: location.href,
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1,h2,h3'))
        .map((heading) => heading.textContent?.trim() ?? '')
        .filter(Boolean),
        forms: Array.from(document.forms).map((form) => ({
          action: form.action,
          method: form.method,
          inputNames: Array.from(form.querySelectorAll('input')).map((input) => input.name || input.id || input.type)
        })),
        links: Array.from(document.querySelectorAll('a'))
        .slice(0, 50)
        .map((link) => ({
          text: link.textContent?.trim() ?? '',
          href: link.href ?? ''
        }))
      };
    });
  }

  async closeContext(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.context.close();
    await this.browser.close();
  }

  private async saveDownload(download: Download, label: string): Promise<DownloadCapture> {
    const capturedAt = new Date().toISOString();
    const suggestedFilename = download.suggestedFilename();
    const path = join(this.runContext.artifactDir, `${Date.now()}-${sanitizeFilePart(label)}-${sanitizeFilePart(suggestedFilename)}`);

    await download.saveAs(path);
    const buffer = await readFile(path);
    const size = await stat(path);

    return {
      label,
      suggestedFilename,
      path,
      sizeBytes: size.size,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      url: this.page.url(),
      capturedAt
    };
  }

  private async maskPasswordFields(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        input[type="password"],
        input[data-agentpass-secret="true"] {
          -webkit-text-security: disc !important;
        }
      `
    });
    await this.page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        document: {
          querySelectorAll(selector: string): Iterable<{
            setAttribute(name: string, value: string): void;
          }>;
        };
      };

      for (const input of Array.from(browserGlobal.document.querySelectorAll('input[type="password"], input[data-agentpass-secret="true"]'))) {
        input.setAttribute('data-agentpass-masked', 'true');
      }
    });
  }

  private installPopupGuard(page: Page): void {
    page.on('popup', (popup) => {
      void this.guardPopup(popup);
    });
  }

  private async guardPopup(popup: Page): Promise<void> {
    try {
      await popup.waitForLoadState('domcontentloaded', { timeout: this.timeoutMs });
    } catch {
      // A blocked or empty popup may never finish loading. It is still closed below.
    }

    const popupUrl = popup.url();
    if (popupUrl && popupUrl !== 'about:blank' && !(await this.isAllowedNetworkUrl(popupUrl))) {
      this.blockedPopupUrls.push(popupUrl);
      await popup.close();
    }
  }

  private assertNoNewBlockedPopup(previousCount: number): void {
    if (this.blockedPopupUrls.length > previousCount) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'New tab navigation was blocked by the domain allowlist.', {
        blockedUrl: this.blockedPopupUrls.at(-1)
      });
    }
  }

  async assertAllowedNetworkUrl(url: string): Promise<void> {
    if (!(await this.isAllowedNetworkUrl(url))) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Navigation blocked by domain allowlist.', { url });
    }
  }

  private async isAllowedNetworkUrl(value: string): Promise<boolean> {
    if (!value || value === 'about:blank') {
      return true;
    }

    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const allowedDomain = this.runContext.allowedDomains.some((domain) => {
      const normalized = domain.toLowerCase();
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });

    if (!allowedDomain) {
      return false;
    }

    if (this.runContext.allowPrivateNetwork) {
      return true;
    }

    return !(await resolvesToPrivateNetwork(hostname));
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Browser context is already closed.');
    }
  }
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || randomUUID();
}

async function resolvesToPrivateNetwork(hostname: string): Promise<boolean> {
  if (isPrivateHostname(hostname)) {
    return true;
  }

  if (isIP(hostname)) {
    return isPrivateIp(hostname);
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.some((record) => isPrivateIp(record.address));
}

function isPrivateHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a = 0, b = 0] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('ff')
    );
  }

  return true;
}
