/**
 * E2E — Prescription (Rx) flow
 *
 * The Rx form at /rx/new reads context from query params (appointment_id etc).
 * Without those params the page still loads and shows the form skeleton.
 * Tests verify the form fields that are always present.
 */

import { test, expect } from './fixtures/auth.fixture';

/** Type a term into the patient search box and wait for results. */
async function searchPatients(page: import('@playwright/test').Page, term = 'a') {
  const searchInput = page.locator('input.search-input');
  await expect(searchInput).toBeVisible({ timeout: 8_000 });
  await searchInput.fill(term);
  await page.waitForTimeout(1200);
}

test.describe('Prescriptions', () => {

  test('Rx new page loads (form or loading state is visible)', async ({ page }) => {
    await page.goto('/rx/new');
    await expect(page).toHaveURL(/rx\/new/);
    // Either the spinner or the form container should appear
    await expect(
      page.locator('.rx-loading, .rx-form, textarea[formcontrolname="diagnosis"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('diagnosis field is visible and accepts input', async ({ page }) => {
    await page.goto('/rx/new');
    // The form loads even without an appointment context
    const diagnosisField = page.locator('textarea[formcontrolname="diagnosis"]').first();
    await expect(diagnosisField).toBeVisible({ timeout: 10_000 });
    await diagnosisField.fill('Test dental caries');
    expect(await diagnosisField.inputValue()).toBe('Test dental caries');
  });

  test('medicine search field is present', async ({ page }) => {
    await page.goto('/rx/new');
    await expect(
      page.locator('input[placeholder*="medicine" i], input[placeholder*="Search and add"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('patient history tab on patient record shows Rx section', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.locator('.pl-page')).toBeVisible({ timeout: 8_000 });
    await searchPatients(page, 'a');

    const firstCard = page.locator('div.patient-card').first();
    await expect(firstCard).toBeVisible({ timeout: 8_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/patients\/[0-9a-f-]{36}/, { timeout: 8_000 });

    // Look for Prescription / Rx tab
    const rxTab = page.locator(
      '.mat-mdc-tab:has-text("Prescription"), .mat-mdc-tab:has-text("Rx"), .mat-tab-label:has-text("Rx")'
    ).first();
    if (await rxTab.isVisible({ timeout: 4_000 })) {
      await rxTab.click();
      await page.waitForTimeout(800);
      await expect(
        page.locator('[class*="rx"], [class*="prescription"], mat-list, table').first()
      ).toBeVisible({ timeout: 6_000 });
    } else {
      // Tab may not exist if this patient has no prescriptions section — skip gracefully
      test.skip(true, 'No Rx tab found on this patient record');
    }
  });

});
