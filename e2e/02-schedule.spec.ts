/**
 * E2E — Schedule / Kanban board
 *
 * Tests: board loads, date navigation, stat filters,
 *        appointment card click, dialog open/close
 */

import { test, expect } from './fixtures/auth.fixture';
import { SchedulePage }  from './pages/schedule.page';

test.describe('Schedule board', () => {

  test.beforeEach(async ({ page }) => {
    const sp = new SchedulePage(page);
    await sp.goto();
  });

  // ── Board renders ──────────────────────────────────────────────────────────

  test('shows stat summary cards (Total / Active / Done / Pending)', async ({ page }) => {
    const sp = new SchedulePage(page);
    await sp.waitForBoard();
    await expect(sp.statCards).toHaveCount(4, { timeout: 8_000 });
    await expect(page.locator('.stat-card:has-text("Total")')).toBeVisible();
    await expect(page.locator('.stat-card:has-text("Active")')).toBeVisible();
    await expect(page.locator('.stat-card:has-text("Done")')).toBeVisible();
    await expect(page.locator('.stat-card:has-text("Pending")')).toBeVisible();
  });

  test('shows kanban columns for services with appointments', async ({ page }) => {
    const sp = new SchedulePage(page);
    await sp.waitForBoard();
    await expect(page.locator('.board-scroll')).toBeVisible();
  });

  test('displays current date in the date navigator', async ({ page }) => {
    const sp    = new SchedulePage(page);
    const label = await sp.dateLabel.textContent();
    expect(label?.trim()).toMatch(/Today|Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });

  // ── Date navigation ────────────────────────────────────────────────────────

  test('next-day button advances the date', async ({ page }) => {
    const sp     = new SchedulePage(page);
    const before = await sp.dateLabel.textContent();
    await sp.nextDayBtn.click();
    await page.waitForTimeout(500);
    const after = await sp.dateLabel.textContent();
    expect(after).not.toBe(before);
  });

  test('today button resets to today', async ({ page }) => {
    const sp = new SchedulePage(page);
    await sp.nextDayBtn.click();
    await page.waitForTimeout(400);
    await sp.todayBtn.click();
    await page.waitForTimeout(500);
    const label = await sp.dateLabel.textContent();
    expect(label?.trim()).toContain('Today');
  });

  test('prev-day button goes backward', async ({ page }) => {
    const sp     = new SchedulePage(page);
    const before = await sp.dateLabel.textContent();
    await sp.prevDayBtn.click();
    await page.waitForTimeout(500);
    const after = await sp.dateLabel.textContent();
    expect(after).not.toBe(before);
  });

  // ── Stat filter pills ──────────────────────────────────────────────────────

  test('clicking "Total" filter chip marks it as active', async ({ page }) => {
    const sp = new SchedulePage(page);
    await sp.clickStatFilter('Total');
    await expect(page.locator('.stat-card:has-text("Total")')).toHaveClass(/stat-card-active/, { timeout: 4_000 });
  });

  test('clicking "Done" filter chip activates it', async ({ page }) => {
    const sp = new SchedulePage(page);
    await sp.clickStatFilter('Done');
    await expect(page.locator('.stat-card:has-text("Done")')).toHaveClass(/stat-card-active/);
  });

  // ── Appointment card ───────────────────────────────────────────────────────

  test('clicking an appointment card opens the detail dialog', async ({ page }) => {
    const sp    = new SchedulePage(page);
    const count = await sp.apptCards.count();
    if (count === 0) {
      test.skip(true, 'No appointments today — board is empty');
      return;
    }
    await sp.openFirstAppointment();
    await expect(page.locator('mat-dialog-container, .appt-dialog')).toBeVisible();
  });

  test('appointment dialog closes on Close button', async ({ page }) => {
    const sp    = new SchedulePage(page);
    const count = await sp.apptCards.count();
    if (count === 0) { test.skip(true, 'No appointments'); return; }
    await sp.openFirstAppointment();
    await sp.closeDialog();
    await expect(page.locator('mat-dialog-container')).not.toBeVisible({ timeout: 5_000 });
  });

  test('appointment dialog shows patient name and status badge', async ({ page }) => {
    const sp    = new SchedulePage(page);
    const count = await sp.apptCards.count();
    if (count === 0) { test.skip(true, 'No appointments'); return; }
    await sp.openFirstAppointment();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog.locator('.dialog-title, h2').first()).toBeVisible();
    await expect(dialog.locator('.status-badge').first()).toBeVisible();
  });

});
