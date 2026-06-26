import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.env.E2E_WEB_URL ?? process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const routes = (process.env.A11Y_ROUTES ?? '/,/login,/register,/forgot-password,/privacy,/terms')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const artifactDir = join(process.cwd(), '.qa-artifacts');
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const results = [];

try {
  for (const route of routes) {
    const url = new URL(route, baseUrl).toString();
    await page.goto(url, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).analyze();
    const blocking = result.violations.filter((violation: { impact?: string | null }) => ['critical', 'serious'].includes(violation.impact ?? ''));
    results.push({ route, violations: result.violations, blockingCount: blocking.length });
  }
} finally {
  await context.close();
  await browser.close();
}

writeFileSync(join(artifactDir, 'accessibility-audit.json'), JSON.stringify({ baseUrl, routes, results }, null, 2));

const blockingTotal = results.reduce((sum, result) => sum + result.blockingCount, 0);
if (blockingTotal > 0) {
  console.error(`Accessibility audit failed with ${blockingTotal} serious/critical violations.`);
  process.exit(1);
}

console.log(`Accessibility audit passed for ${routes.length} routes.`);
