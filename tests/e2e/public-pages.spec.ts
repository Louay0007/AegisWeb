import { test, expect } from '@playwright/test';

test.describe('public pages', () => {
  for (const path of ['/', '/login', '/register', '/forgot-password']) {
    test(`loads ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveTitle(/AegisWeb|AgentPass|Aegis/i);
    });
  }
});
