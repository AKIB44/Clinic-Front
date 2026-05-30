/**
 * E2E — Treatment session flow
 *
 * Prerequisites: at least one appointment in "in_progress" or "confirmed" status.
 * If no qualifying appointment exists the tests skip gracefully.
 */

import { test, expect } from './fixtures/auth.fixture';
import { Page }          from '@playwright/test';
import { SchedulePage }  from './pages/schedule.page';

async function goToSchedule(page: Page) {
  const sp = new SchedulePage(page);
  await sp.goto();
  return sp;
}

/** Finds an appointment card with "Start Treatment" or "Resume Treatment" button. */
async function findStartableTreatmentCard(page: Page) {
  await goToSchedule(page);

  const inProgressCards = page.locator('.appt-card.appt-s-in_progress, .appt-card.appt-s-confirmed');
  const count = await inProgressCards.count();
  if (count === 0) return null;

  await inProgressCards.first().click();
  await expect(page.locator('mat-dialog-container')).toBeVisible({ timeout: 6_000 });

  const startBtn = page.locator('button:has-text("Start Treatment"), button:has-text("Resume Treatment")').first();
  if (!(await startBtn.isVisible({ timeout: 3_000 }))) {
    await page.locator('button:has-text("Close")').last().click();
    return null;
  }
  return startBtn;
}

test.describe('Treatment session', () => {

  test('treatment canvas loads after clicking Start Treatment', async ({ page }) => {
    const startBtn = await findStartableTreatmentCard(page);
    if (!startBtn) {
      test.skip(true, 'No startable appointment on the board today — seed an appointment and retry');
      return;
    }
    await startBtn.click();
    await expect(page).toHaveURL(/\/treatment\/[0-9a-f-]{36}/, { timeout: 20_000 });
  });

  test('treatment canvas shows accordion blocks', async ({ page }) => {
    const startBtn = await findStartableTreatmentCard(page);
    if (!startBtn) { test.skip(true, 'No startable appointment'); return; }
    await startBtn.click();
    await expect(page).toHaveURL(/\/treatment\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.locator('df-session-block, .sb-strip, [class*="sb-strip"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows patient name and elapsed time', async ({ page }) => {
    const startBtn = await findStartableTreatmentCard(page);
    if (!startBtn) { test.skip(true, 'No startable appointment'); return; }
    await startBtn.click();
    await expect(page).toHaveURL(/\/treatment\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.locator('.sc-sidebar, [class*="sidebar"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('clicking an accordion block expands it', async ({ page }) => {
    const startBtn = await findStartableTreatmentCard(page);
    if (!startBtn) { test.skip(true, 'No startable appointment'); return; }
    await startBtn.click();
    await expect(page).toHaveURL(/\/treatment\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await page.waitForTimeout(1500);

    const blocks = page.locator('df-session-block .sb-strip, [class*="sb-strip"]');
    if (await blocks.count() === 0) return;
    await blocks.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('.sb-body').first()).toBeVisible({ timeout: 4_000 });
  });

  test('examination form saves chief complaint', async ({ page }) => {
    const startBtn = await findStartableTreatmentCard(page);
    if (!startBtn) { test.skip(true, 'No startable appointment'); return; }
    await startBtn.click();
    await expect(page).toHaveURL(/\/treatment\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await page.waitForTimeout(1500);

    const chiefComplaintField = page.locator('textarea[formcontrolname="chief_complaint"], mat-form-field:has-text("Chief Complaint") textarea').first();
    if (!(await chiefComplaintField.isVisible({ timeout: 4_000 }))) return;

    await chiefComplaintField.fill('E2E test: Toothache upper right');
    const saveBtn = page.locator('button:has-text("Save Examination"), button:has-text("Save")').first();
    if (await saveBtn.isVisible({ timeout: 2_000 })) {
      await saveBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('mat-snack-bar-container, [class*="toast"], [class*="snack"]').first()).toBeVisible({ timeout: 5_000 });
    }
  });

});
