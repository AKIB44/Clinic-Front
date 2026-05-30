/**
 * E2E — Navigation & routing smoke tests
 *
 * Verifies every main route loads without a blank page or JS error.
 */

import { test, expect } from './fixtures/auth.fixture';

const ROUTES = [
  { path: '/schedule', title: /schedule/i },
  { path: '/patients', title: /patient/i  },
  { path: '/rx/new',   title: /rx|prescription/i },
  { path: '/master',   title: /master|service/i  },
];

test.describe('Navigation smoke tests', () => {

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
  });

  for (const route of ROUTES) {
    test(`${route.path} loads without crashing`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(2000);

      await expect(page).not.toHaveURL(/authentication\/login/, { timeout: 5_000 });

      const ngErrors = consoleErrors.filter(e =>
        e.includes('ERROR') || e.includes('ExpressionChangedAfterItHasBeenCheckedError')
      );
      expect(ngErrors).toHaveLength(0);
    });
  }

  test('unknown route redirects gracefully (no blank page)', async ({ page }) => {
    await page.goto('/completely-nonexistent-route-xyz');
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('back button after navigation works correctly', async ({ page }) => {
    await page.goto('/schedule');
    await page.waitForTimeout(1000);
    await page.goto('/patients');
    await page.waitForTimeout(1000);
    await page.goBack();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/schedule/);
  });

});
