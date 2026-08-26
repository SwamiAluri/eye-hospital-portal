/**
 * Shared Playwright helpers for CCMS E2E tests.
 */
import { type Page, expect } from '@playwright/test';

// ── Navigation ────────────────────────────────────────────────────────────────

export async function goCcmsCases(page: Page) {
  await page.goto('/dashboard/ccms/cases');
  await expect(page.getByRole('heading', { name: /coverage.cases|cases/i }))
    .toBeVisible({ timeout: 10_000 });
}

export async function goCcmsPreAuth(page: Page) {
  await page.goto('/dashboard/ccms/operations/preauth');
  await expect(page.getByRole('heading', { name: /pre.auth|preauth/i }))
    .toBeVisible({ timeout: 10_000 });
}

export async function goCcmsClaims(page: Page) {
  await page.goto('/dashboard/ccms/claims');
  await expect(page.getByRole('heading', { name: /claim/i }))
    .toBeVisible({ timeout: 10_000 });
}

export async function goCcmsReconciliation(page: Page) {
  await page.goto('/dashboard/ccms/operations/reconciliation');
  await expect(page.getByRole('heading', { name: /reconcil/i }))
    .toBeVisible({ timeout: 10_000 });
}

export async function goCcmsAnalytics(page: Page) {
  await page.goto('/dashboard/ccms/analytics');
  await expect(page.getByRole('heading', { name: /analytic/i }))
    .toBeVisible({ timeout: 10_000 });
}

export async function goCcmsOperationalAnalytics(page: Page) {
  await page.goto('/dashboard/ccms/analytics/operational');
  await expect(page.getByTestId('ccms-operational-analytics')).toBeVisible({ timeout: 20_000 });
}

// ── Assertions ────────────────────────────────────────────────────────────────

/** Asserts that no error/crash UI is visible on the page. */
export async function expectNoErrorState(page: Page) {
  await expect(page.getByRole('alert')).not.toBeVisible();
  await expect(page.getByText(/something went wrong|unexpected error|500/i)).not.toBeVisible();
}

/** Waits for and asserts the table has at least one data row. */
export async function expectTableHasRows(page: Page, minRows = 1) {
  const tbody = page.locator('tbody tr');
  await expect(tbody.first()).toBeVisible({ timeout: 8_000 });
  await expect(tbody).toHaveCount(
    await tbody.count() >= minRows ? await tbody.count() : minRows,
  );
}
