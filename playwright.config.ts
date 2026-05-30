import { defineConfig, devices } from '@playwright/test';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export default defineConfig({
  testDir:       './e2e',
  globalSetup:   './e2e/global-setup.ts',
  fullyParallel: false,
  retries:       1,
  workers:       1,
  reporter:      [['html', { open: 'never' }], ['list']],
  timeout:       40_000,
  expect:        { timeout: 8_000 },

  use: {
    baseURL:    'http://localhost:4200',
    headless:   true,
    screenshot: 'only-on-failure',
    video:      'off',
    trace:      'off',
    launchOptions: {
      executablePath: CHROME_PATH,
    },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Does NOT start dev server — assumes `ng serve` is already running on :4200
});
