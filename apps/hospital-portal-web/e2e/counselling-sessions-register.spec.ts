/**
 * Counselling Sessions register — purpose, drill-down chips, and return navigation.
 * Analytics calculations are not exercised. This file checks the destination UX only.
 */
import { test, expect } from '@playwright/test';

test.describe('Counselling Sessions register @counselling', () => {
  test.describe.configure({ timeout: 90_000 });

  test('sidebar destination is one register with Filters, search, owner, and status', async ({
    page,
  }) => {
    await page.goto('/dashboard/counsellors-desk/sessions', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sessions-filters-open')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByPlaceholder('Search session number')).toBeVisible();
    await expect(page.getByTestId('sessions-purpose-line')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Session views' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Owner' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await page.getByTestId('sessions-filters-open').click();
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
    await expect(page.getByLabel('Reassignment required')).toBeVisible();
  });

  test('Agreed drill-down shows Analytics context, one outcome chip, and returns to Analytics', async ({
    page,
  }) => {
    await page.goto(
      '/dashboard/counsellors-desk/sessions?analyticsOutcome=Agreed&patientAgreedToSurgery=true&pendingDecision=false&sessionDateFrom=2026-09-01&sessionDateTo=2026-09-27',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByTestId('sessions-analytics-context')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('link', { name: 'Back to Analytics' })).toHaveAttribute(
      'href',
      '/dashboard/counselor/analytics',
    );
    await page.getByRole('link', { name: 'Back to Analytics' }).click();
    await expect(page).toHaveURL(/\/dashboard\/counselor\/analytics/);
    await page.goto(
      '/dashboard/counsellors-desk/sessions?analyticsOutcome=Agreed&patientAgreedToSurgery=true&pendingDecision=false&sessionDateFrom=2026-09-01&sessionDateTo=2026-09-27',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('button', { name: 'Remove Decision Agreed filter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove date range filter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agreed to surgery' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Remove Decision Agreed filter' }).click();
    await expect(page).toHaveURL(/sessionDateFrom=2026-09-01/);
    await expect(page).not.toHaveURL(/pendingDecision=/);
    await expect(page).not.toHaveURL(/analyticsOutcome=/);

    await page.getByTestId('sessions-list-clear').click();
    await expect(page).not.toHaveURL(/sessionDateFrom=/);
    await expect(page).toHaveURL(/\/dashboard\/counsellors-desk\/sessions\/?$/);
  });

  test('Clear removes Reassignment Required along with the other filters', async ({ page }) => {
    await page.goto(
      '/dashboard/counsellors-desk/sessions?reassignmentRequired=true&analyticsOutcome=Agreed&patientAgreedToSurgery=true&pendingDecision=false',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('button', { name: 'Remove Reassignment required filter' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId('sessions-reassignment-purpose')).toHaveCount(0);
    await page.getByTestId('sessions-list-clear').click();
    await expect(page).not.toHaveURL(/reassignmentRequired=/);
    await expect(page).not.toHaveURL(/analyticsOutcome=/);
    await expect(page).toHaveURL(/\/dashboard\/counsellors-desk\/sessions\/?$/);
  });

  test('Open from the register carries the list query and Close returns to it', async ({ page }) => {
    await page.goto(
      '/dashboard/counsellors-desk/sessions?analyticsOutcome=Total',
      { waitUntil: 'domcontentloaded' },
    );
    const open = page.getByTestId('sessions-row-open').first();
    await expect(open).toBeVisible({ timeout: 60_000 });
    await open.click();
    await expect(page).toHaveURL(/from=sessions/);
    await expect(page).toHaveURL(/returnQuery=/);
    const close = page.getByTestId('counselling-btn-close-session');
    await expect(close).toBeVisible({ timeout: 60_000 });
    await close.click();
    await expect(page).toHaveURL(/\/dashboard\/counsellors-desk\/sessions/);
    await expect(page).toHaveURL(/analyticsOutcome=Total/);
    await expect(page).not.toHaveURL(/waiting-list/);
  });
});
