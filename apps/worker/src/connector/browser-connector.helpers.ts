import { generate } from 'otplib';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConnectorExecutionContext } from './vendor-connector.types.js';

export async function requireVisible(
  context: ConnectorExecutionContext,
  selector: string,
  description: string,
  timeoutMs = 8000
): Promise<void> {
  try {
    await context.browser.page.locator(selector).first().waitFor({
      state: 'visible',
      timeout: timeoutMs
    });
  } catch {
    throw new DomainError(
      DomainErrorCode.VendorPageStructureChanged,
      `Expected vendor page element was missing: ${description} (${selector}).`,
      { selector, description, url: context.browser.page.url() }
    );
  }
}

export async function pageLooksLikeMfa(context: ConnectorExecutionContext): Promise<boolean> {
  const body = ((await context.browser.page.locator('body').textContent()) ?? '').toLowerCase();
  const url = context.browser.page.url().toLowerCase();
  return (
    url.includes('mfa') ||
    url.includes('two-factor') ||
    url.includes('2fa') ||
    body.includes('authenticator') ||
    body.includes('verification code') ||
    body.includes('one-time password') ||
    body.includes('two-factor') ||
    Boolean(await context.browser.page.locator('input[name*="otp" i], input[name*="totp" i], input[autocomplete="one-time-code"]').count())
  );
}

export async function completeTotpIfRequired(
  context: ConnectorExecutionContext,
  options: {
    codeSelector: string;
    submitSelector: string;
    connectorName: string;
  }
): Promise<void> {
  if (!(await pageLooksLikeMfa(context))) {
    return;
  }

  if (!context.credentials.totpSecret) {
    throw new DomainError(
      DomainErrorCode.ManualMfaRequired,
      `${options.connectorName} requires MFA, but no totpSecret was present in the vaulted credential.`,
      { connector: options.connectorName, url: context.browser.page.url() }
    );
  }

  const code = await generate({ secret: context.credentials.totpSecret });
  await requireVisible(context, options.codeSelector, 'MFA code input');
  await context.browser.page.locator(options.codeSelector).first().fill(String(code));
  await requireVisible(context, options.submitSelector, 'MFA submit');
  await context.browser.page.locator(options.submitSelector).first().click();
  await context.browser.page.waitForLoadState('domcontentloaded');

  if (await pageLooksLikeMfa(context)) {
    throw new DomainError(
      DomainErrorCode.ManualMfaRequired,
      `${options.connectorName} MFA challenge remained after TOTP submission. Manual handoff is required.`,
      { connector: options.connectorName, url: context.browser.page.url() }
    );
  }
}

export function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function centsFromText(raw: string | null | undefined): number {
  if (!raw) {
    return 0;
  }
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}
