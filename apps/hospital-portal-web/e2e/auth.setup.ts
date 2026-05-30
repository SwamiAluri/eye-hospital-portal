/**
 * Playwright auth setup — runs once before any test project.
 * Logs in with a test user and saves the browser storage state so all
 * subsequent test files share the same authenticated session.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate as test user', async ({ page }) => {
  await page.goto('/login');

  // Fill credentials — override with env vars so CI can supply real creds
  await page.getByLabel(/email|username/i).fill(
    process.env.E2E_TEST_EMAIL ?? 'admin@hospital.local',
  );
  await page.getByLabel(/password/i).fill(
    process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
  );
  await page.getByRole('button', { name: /sign in|login|submit/i }).click();

  // Wait for redirect to the dashboard — indicates successful login
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

  // Persist auth cookies / localStorage for the entire test suite
  await page.context().storageState({ path: AUTH_FILE });
});
