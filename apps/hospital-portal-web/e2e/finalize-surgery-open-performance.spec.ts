import { test, expect, type Page, type Route } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';

const CASE_A = '11111111-1111-1111-1111-111111111111';
const CASE_B = '22222222-2222-2222-2222-222222222222';

function scheduleRow(id: string, patientName: string, uhid: string) {
  return {
    id,
    uhid,
    patientName,
    surgeryName: 'Phaco + IOL',
    eye: 'RE',
    status: 'NotConfirmed',
    version: 1,
    isLocked: false,
    doctorName: 'Dr. Rao',
    theatreName: 'OT 1',
    startTime: '2026-09-28T09:00:00',
    reportingTime: '07:30:00',
  };
}

function scheduleDetail(id: string, patientName: string, uhid: string) {
  return {
    ...scheduleRow(id, patientName, uhid),
    theatreId: 'th-1',
    diagnosis: 'H25.1 Age-related cataract',
    anesthetistName: 'Dr. Nair',
  };
}

async function holdJson(route: Route, release: Promise<void>, body: unknown) {
  await release;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installFinalizeRoutes(
  page: Page,
  gates: { surgeons?: Promise<void>; theaters?: Promise<void>; anesthetists?: Promise<void> },
) {
  await page.route(/\/Counseling\/ot-schedule\/[0-9a-f-]+\/confirm/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...scheduleRow(CASE_A, 'Kamala Rao', 'UH-P2A'),
        status: 'Confirmed',
      }),
    });
  });
  await page.route(/\/Counseling\/ot-schedule\/[0-9a-f-]+\/details/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scheduleRow(CASE_A, 'Kamala Rao', 'UH-P2A')),
    });
  });
  await page.route(/\/Counseling\/ot-schedule\/[0-9a-f-]+$/i, async (route) => {
    const id = route.request().url().match(/ot-schedule\/([0-9a-f-]+)/i)?.[1] ?? CASE_A;
    const detail = id === CASE_B
      ? scheduleDetail(CASE_B, 'Lakshmi Iyer', 'UH-P2B')
      : scheduleDetail(CASE_A, 'Kamala Rao', 'UH-P2A');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detail),
    });
  });
  await page.route(/\/Counseling\/ot-schedule(\?|$)/i, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        scheduleRow(CASE_A, 'Kamala Rao', 'UH-P2A'),
        scheduleRow(CASE_B, 'Lakshmi Iyer', 'UH-P2B'),
      ]),
    });
  });
  await page.route(/\/Counseling\/surgeons/i, (route) =>
    holdJson(route, gates.surgeons ?? Promise.resolve(), [{ id: 's1', fullName: 'Dr. Rao' }]));
  await page.route(/\/Counseling\/theaters/i, (route) =>
    holdJson(route, gates.theaters ?? Promise.resolve(), [{ id: 'th-1', theaterName: 'OT 1' }]));
  await page.route(/\/Counseling\/anesthetists/i, (route) =>
    holdJson(route, gates.anesthetists ?? Promise.resolve(), [{ id: 'a1', fullName: 'Dr. Nair' }]));
}

test.describe('Finalize Surgery open performance', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
  });

  test('case context appears while an independent directory is still loading', async ({ page }) => {
    let releaseSurgeons!: () => void;
    const surgeons = new Promise<void>((resolve) => { releaseSurgeons = resolve; });
    await installFinalizeRoutes(page, { surgeons });
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('finalize-surgery-work-row').first().click();
    const dialog = page.getByTestId('finalize-ot-modal');
    await expect(dialog.getByTestId('finalize-ot-patient-name')).toHaveText('Kamala Rao', { timeout: 20_000 });
    await expect(dialog.getByText('UH-P2A')).toBeVisible();
    await expect(dialog.getByText('H25.1 Age-related cataract')).toBeVisible();
    await expect(dialog.getByTestId('finalize-ot-surgeon-loading')).toBeVisible();
    await expect(dialog.getByTestId('finalize-ot-confirm')).toBeDisabled();

    releaseSurgeons();
    await expect(dialog.getByTestId('finalize-ot-surgeon-loading')).toHaveCount(0);
    await expect(dialog.getByTestId('finalize-ot-select-surgeon')).toBeVisible();
  });

  test('theatre and anaesthetist delays do not block the case shell', async ({ page }) => {
    let releaseTheaters!: () => void;
    let releaseAnesthetists!: () => void;
    const theaters = new Promise<void>((resolve) => { releaseTheaters = resolve; });
    const anesthetists = new Promise<void>((resolve) => { releaseAnesthetists = resolve; });
    await installFinalizeRoutes(page, { theaters, anesthetists });
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('finalize-surgery-work-row').first().click();
    const dialog = page.getByTestId('finalize-ot-modal');
    await expect(dialog.getByTestId('finalize-ot-patient-name')).toHaveText('Kamala Rao', { timeout: 20_000 });
    await expect(dialog.getByTestId('finalize-ot-theatre-loading')).toBeVisible();
    await expect(dialog.getByTestId('anesthetist-select-loading')).toBeVisible();
    await expect(dialog.getByTestId('finalize-ot-confirm')).toBeDisabled();

    releaseTheaters();
    await expect(dialog.getByTestId('finalize-ot-theatre-loading')).toHaveCount(0);
    await expect(dialog.getByTestId('finalize-ot-select-theatre')).toBeVisible();
    await expect(dialog.getByTestId('anesthetist-select-loading')).toBeVisible();

    releaseAnesthetists();
    await expect(dialog.getByTestId('anesthetist-select')).toBeVisible();
    await expect(dialog.getByTestId('finalize-ot-confirm')).toBeEnabled();
  });

  test('confirm stays available after directories arrive and close returns to the grid', async ({ page }) => {
    await installFinalizeRoutes(page, {});
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('finalize-surgery-work-row').first().click();
    const dialog = page.getByTestId('finalize-ot-modal');
    await expect(dialog.getByTestId('finalize-ot-confirm')).toBeEnabled({ timeout: 20_000 });
    await dialog.getByTestId('finalize-ot-confirm').click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard\/counsellors-desk\/finalize-surgery/);
    await expect(page.getByTestId('finalize-surgery-work-row').first()).toContainText('Confirmed');
  });

  test('opening a second case replaces the first patient', async ({ page }) => {
    await installFinalizeRoutes(page, {});
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
    const rows = page.getByTestId('finalize-surgery-work-row');
    await rows.nth(0).click();
    const dialog = page.getByTestId('finalize-ot-modal');
    await expect(dialog.getByTestId('finalize-ot-patient-name')).toHaveText('Kamala Rao', { timeout: 20_000 });
    await dialog.getByRole('button').filter({ hasText: /^Close$/ }).click();
    await expect(dialog).toHaveCount(0);

    await rows.nth(1).click();
    await expect(page.getByTestId('finalize-ot-patient-name')).toHaveText('Lakshmi Iyer', { timeout: 20_000 });
    await expect(page.getByTestId('finalize-ot-modal')).not.toContainText('Kamala Rao');
    await expect(page.getByTestId('finalize-ot-modal')).toContainText('UH-P2B');
  });
});
