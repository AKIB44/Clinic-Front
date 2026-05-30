import { Page, expect, Locator } from '@playwright/test';

export class SchedulePage {
  readonly statCards:    Locator;
  readonly boardColumns: Locator;
  readonly apptCards:    Locator;
  readonly dateLabel:    Locator;
  readonly nextDayBtn:   Locator;
  readonly prevDayBtn:   Locator;
  readonly todayBtn:     Locator;

  constructor(private page: Page) {
    this.statCards    = page.locator('.stat-card');
    this.boardColumns = page.locator('.kanban-col');
    this.apptCards    = page.locator('.appt-card');
    this.dateLabel    = page.locator('.date-label-btn');
    this.nextDayBtn   = page.locator('.date-nav button[matooltip="Next day"], button[mattooltip="Next day"]').first();
    this.prevDayBtn   = page.locator('.date-nav button[matooltip="Previous day"], button[mattooltip="Previous day"]').first();
    this.todayBtn     = page.locator('.date-nav-today, button[mattooltip="Go to today"]').first();
  }

  async goto() {
    await this.page.goto('/schedule');
    await this.waitForBoard();
  }

  async waitForBoard() {
    // Wait until loading skeletons are gone and stat cards appear
    await expect(this.statCards.first()).toBeVisible({ timeout: 15_000 });
  }

  async clickStatFilter(label: 'Total' | 'Active' | 'Done' | 'Pending') {
    await this.page.locator(`.stat-card:has-text("${label}")`).click();
    await this.page.waitForTimeout(300);
  }

  async openFirstAppointment() {
    const card = this.apptCards.first();
    await expect(card).toBeVisible({ timeout: 8_000 });
    await card.click();
    // Dialog should appear
    await expect(this.page.locator('.appt-dialog, mat-dialog-container')).toBeVisible({ timeout: 6_000 });
  }

  async closeDialog() {
    const closeBtn = this.page.locator('button:has-text("Close"), button[mat-dialog-close]').last();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await this.page.waitForTimeout(300);
  }
}
