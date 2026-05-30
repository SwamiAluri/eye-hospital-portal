import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for the Hospital Portal web app.
 *
 * Run tests:
 *   npm run test:e2e                     # headless, all browsers
 *   npm run test:e2e:ui                  # interactive UI mode
 *   npx playwright test --project=chromium  # single browser
 *
 * CI behaviour:
 *   - Uses a local Next.js dev server (webServer) so tests can run without
 *     a pre-deployed environment.
 *   - On CI set PLAYWRIGHT_BASE_URL to point at a deployed environment to
 *     skip the local server startup.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.test-results',

  /* How many times to retry a failed test on CI */
  retries: process.env.CI ? 2 : 0,

  /* Run test files in parallel */
  fullyParallel: true,

  /* Reporter */
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'e2e/playwright-report', open: 'on-failure' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    /* Reuse auth state across tests in the same file */
    storageState: 'e2e/.auth/user.json',

    /* Record a trace for every failed test */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Reasonable default timeout for actions */
    actionTimeout: 10_000,
  },

  /* Browsers to test across */
  projects: [
    // Setup project: logs in once, saves auth state
    {
      name: 'setup',
      testMatch: '**/e2e/auth.setup.ts',
      use: { storageState: undefined },
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
  ],

  /* Start the Next.js dev server automatically for local runs */
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          // Use a throwaway JWT secret and stub API for E2E
          NEXTAUTH_URL: 'http://localhost:3000',
          NEXTAUTH_SECRET: 'playwright-test-secret',
          NEXT_PUBLIC_API_URL: process.env.E2E_API_URL ?? 'http://localhost:5073/api',
        },
      },

  /* Global timeout per test */
  timeout: 30_000,
  expect: { timeout: 5_000 },
});
