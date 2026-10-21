import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3334', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node --env-file-if-exists=.env --import tsx scripts/e2e-server.ts',
    url: 'http://127.0.0.1:3334/api/health',
    timeout: 90000,
    reuseExistingServer: false,
  },
});
