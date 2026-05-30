import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/authentication/login');
    await expect(this.page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  }

  /** Fill credentials and click submit — makes NO assertions about the outcome. */
  async fillAndSubmit(email: string, password: string) {
    await this.page.fill('input[type="email"]',                    email);
    await this.page.fill('input[autocomplete="current-password"]', password);
    await this.page.click('button[type="submit"]');
  }

  /** Fill, submit, then wait for a redirect away from the login page. */
  async login(email = 'admin@sharayudental.com', password = 'Password123') {
    await this.fillAndSubmit(email, password);
    await expect(this.page).not.toHaveURL(/authentication\/login/, { timeout: 15_000 });
  }

  /** Navigate to login → fill → submit → assert landed on app. */
  async loginAndWait(email?: string, password?: string) {
    await this.goto();
    await this.login(email, password);
    await expect(this.page).toHaveURL(/schedule|dashboard|starter/, { timeout: 12_000 });
  }
}
