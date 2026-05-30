/**
 * E2E — Authentication flow
 *
 * Tests: redirect, form fields, wrong password, successful login, session persistence.
 * storageState is cleared so every test runs as an unauthenticated visitor.
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

// Auth tests must start without a saved session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page).toHaveURL(/authentication\/login/, { timeout: 10_000 });
  });

  test('shows login form with email + password fields', async ({ page }) => {
    await page.goto('/authentication/login');
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('shows error on wrong password', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.fillAndSubmit('admin@sharayudental.com', 'WRONG_PASSWORD');
    // Should stay on login page
    await expect(page).toHaveURL(/authentication\/login/, { timeout: 6_000 });
    // Error message should appear
    await expect(page.locator('.df-error-alert').first()).toBeVisible({ timeout: 5_000 });
  });

  test('successfully logs in with correct credentials', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.loginAndWait();
    await expect(page).not.toHaveURL(/authentication\/login/);
  });

  test('preserves session across page reload', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.loginAndWait();
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/authentication\/login/, { timeout: 8_000 });
  });

});
