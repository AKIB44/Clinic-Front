/**
 * Authenticated test fixture.
 *
 * Injects the saved access/refresh tokens into sessionStorage before
 * Angular bootstraps, so every test starts in an authenticated state.
 *
 * Usage: import { test, expect } from '../fixtures/auth.fixture';
 */

import { test as base, expect } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/tokens.json');

interface Tokens {
  access_token:  string;
  refresh_token: string;
  user:          unknown;
}

export const test = base.extend<{ _injectAuth: void }>({
  _injectAuth: [async ({ page }, use) => {
    if (fs.existsSync(AUTH_FILE)) {
      const tokens: Tokens = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      // Runs before every navigation inside this test
      await page.addInitScript((t: Tokens) => {
        sessionStorage.setItem('dentaflow_access_token',  t.access_token);
        sessionStorage.setItem('dentaflow_refresh_token', t.refresh_token);
        sessionStorage.setItem('dentaflow_user',          JSON.stringify(t.user));
      }, tokens);
    }
    await use();
  }, { auto: true }],  // auto: true applies to every test in files that import this fixture
});

export { expect };
