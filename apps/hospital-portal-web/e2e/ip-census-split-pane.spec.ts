/**
 * IP-001 — census docked split pane: no desktop scrim, URL restore, keyboard.
 *
 *   npx playwright test e2e/ip-census-split-pane.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { IP_CENSUS_TEST_IDS } from '../src/lib/ip-management/ip-census-test-ids';

const JOURNEY_A = '11111111-1111-4111-8111-111111111111';
const JOURNEY_B = '22222222-2222-4222-8222-222222222222';

function journeyRow(id: string, name: string, eyeOperated: string | null) {
  return {
    id,
    patientId: id,
    uhid: id.slice(0, 8),
    patientName: name,
    eyeOperated,
    procedureName: 'Phaco',
    packageAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    wardName: 'Day Care',
    bedNumber: 'B-01',
    clinicalState: 'Admitted',
    otState: 'NotSent',
    financialState: 'Draft',
    postOpState: 'NotStarted',
    admittedAt: '2026-08-24T08:00:00Z',
    surgeryScheduledAt: null,
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'Elective',
    patientGender: 'F',
    patientDob: '1972-03-14',
    patientAge: 54,
    paymentMode: null,
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
    updatedAt: '2026-08-24T08:00:00Z',
  };
}

async function mockCensusJourneys(page: Page) {
  const rows = [
    journeyRow(JOURNEY_A, 'Meena Iyer', 'OD'),
    journeyRow(JOURNEY_B, 'Tara Nair', null),
  ];

  await page.route('**/ip-management/journeys**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, '');
    if (!/\/ip-management\/journeys$/.test(path)) {
      await route.continue();
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });

  // Last matching route wins — keep this after the list mock.
  await page.route('**/ip-management/journeys/**/transition-gates**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transition: 'ReadyForSurgery',
        canProceed: true,
        requiresOverride: false,
        warnings: [],
      }),
    });
  });
}

async function openCensus(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await loginAsRole(page, 'admin');
  await mockCensusJourneys(page);
  await page.goto('/dashboard/ip-management', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible({ timeout: 20_000 });
}

test.describe('IP-001 census split pane @ip-census', () => {
  test.describe.configure({ timeout: 90_000 });

  test('desktop docks the rail with no scrim or blur; URL restore and header stay usable', async ({ page }) => {
    await openCensus(page, { width: 1400, height: 900 });

    await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();

    await expect(page).toHaveURL(/[?&]patient=/);
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.identBanner)).toBeVisible();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.split)).toBeVisible();

    await expect(page.locator('[data-radix-dialog-overlay]')).toHaveCount(0);
    await expect(page.locator('[class*="backdrop-blur"]')).toHaveCount(0);
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.scrim)).toHaveCount(0);

    await expect(page.getByRole('heading', { name: 'IP Management' })).toBeVisible();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_B))).toBeVisible();

    const logout = page.getByTitle('Logout');
    await expect(logout).toBeVisible();
    const box = await logout.boundingBox();
    expect(box).toBeTruthy();
    const hitTitle = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest('button')?.getAttribute('title') ?? null;
    }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
    expect(hitTitle).toBe('Logout');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`patient=${JOURNEY_A}`));
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.identBanner)).toContainText('Meena Iyer');
  });

  test('rail has one primary action, one billing link, and no jargon', async ({ page }) => {
    await openCensus(page, { width: 1400, height: 900 });
    await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();

    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction)).toHaveCount(1);
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.openBilling)).toHaveCount(1);
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.openFullRecord)).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Refund$/i })).toHaveCount(0);
    await expect(page.getByText('OpdBill')).toHaveCount(0);
    await expect(page.getByText('Where is the patient?')).toHaveCount(0);
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.alertStrip)).toHaveCount(0);
  });

  test('j/k move selection and slash focuses search', async ({ page }) => {
    await openCensus(page, { width: 1400, height: 900 });
    await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
    await expect(page).toHaveURL(new RegExp(`patient=${JOURNEY_A}`));

    await page.keyboard.press('j');
    await expect(page).toHaveURL(new RegExp(`patient=${JOURNEY_B}`));
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_B))).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.lateralityBlocker)).toBeVisible();

    await page.keyboard.press('k');
    await expect(page).toHaveURL(new RegExp(`patient=${JOURNEY_A}`));

    await page.keyboard.press('/');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.search)).toBeFocused();
  });

  test('sheet mode is a dialog: dim overlay, Escape closes, docked Escape does not', async ({ page }) => {
    await openCensus(page, { width: 1400, height: 900 });
    await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();
    await expect(page).toHaveURL(/patient=/);

    await page.setViewportSize({ width: 1100, height: 800 });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.scrim)).toBeVisible();
    await expect(page.locator('[class*="backdrop-blur-["]')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/patient=/);
  });

  test('below 1024 rows are cards that open the journey record', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await loginAsRole(page, 'admin');
    await mockCensusJourneys(page);
    await page.goto('/dashboard/ip-management', { waitUntil: 'domcontentloaded' });

    const card = page.getByTestId(IP_CENSUS_TEST_IDS.card(JOURNEY_A));
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/ip-management/journey/${JOURNEY_A}`));
  });
});
