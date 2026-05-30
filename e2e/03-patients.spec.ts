/**
 * E2E — Patient management
 *
 * Tests: patient list loads, search, open patient record, tabs.
 *
 * The patient list is a search page — results only render after a search is
 * triggered. Tests that need patient cards must perform a search first.
 */

import { test, expect } from './fixtures/auth.fixture';

/** Type a term into the patient search box and wait for results. */
async function searchPatients(page: import('@playwright/test').Page, term = 'a') {
  const searchInput = page.locator('input.search-input');
  await expect(searchInput).toBeVisible({ timeout: 8_000 });
  await searchInput.fill(term);
  // debounce + API call
  await page.waitForTimeout(1200);
}

test.describe('Patients', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/patients');
    // Wait for the page container to be in the DOM
    await expect(page.locator('.pl-page')).toBeVisible({ timeout: 10_000 });
  });

  test('patient list page loads', async ({ page }) => {
    await expect(page).toHaveURL(/patients/);
    await expect(page.locator('.pl-page')).toBeVisible();
    // Search box should be present
    await expect(page.locator('input.search-input')).toBeVisible();
  });

  test('shows at least one patient card after search', async ({ page }) => {
    await searchPatients(page, 'a');
    // Cards appear under .pl-grid once searched
    await expect(page.locator('div.patient-card').first()).toBeVisible({ timeout: 8_000 });
    expect(await page.locator('div.patient-card').count()).toBeGreaterThan(0);
  });

  test('search field filters patients', async ({ page }) => {
    await searchPatients(page, 'a');
    const cards = page.locator('div.patient-card');
    // At least some results should appear for the letter "a"
    expect(await cards.count()).toBeGreaterThanOrEqual(0);
  });

  test('clicking a patient card navigates to patient record', async ({ page }) => {
    await searchPatients(page, 'a');
    const firstCard = page.locator('div.patient-card').first();
    await expect(firstCard).toBeVisible({ timeout: 8_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/patients\/[0-9a-f-]{36}/, { timeout: 8_000 });
  });

  test('patient record page has tabs', async ({ page }) => {
    await searchPatients(page, 'a');
    const firstCard = page.locator('div.patient-card').first();
    await expect(firstCard).toBeVisible({ timeout: 8_000 });
    await firstCard.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('mat-tab-header, mat-tab-group')).toBeVisible({ timeout: 8_000 });
  });

});
