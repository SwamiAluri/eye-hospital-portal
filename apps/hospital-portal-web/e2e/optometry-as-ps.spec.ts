/**
 * Program A — AS/PS mega-tab smoke & manual-scenario automation.
 *
 * Requires seed data:
 *   E2E_OPTOMETRY_PATIENT_ID  — patient UUID
 *   E2E_OPTOMETRY_VISIT_ID    — open optometry visit UUID
 *
 * Run:
 *   E2E_OPTOMETRY_PATIENT_ID=... E2E_OPTOMETRY_VISIT_ID=... npx playwright test e2e/optometry-as-ps.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import {
  clickExamTab,
  expandSection,
  fillPosteriorOverviewField,
  fillRequiredPupilExam,
  goOptometryExam,
  hasOptometryFixture,
  markMaculaOdNormalWithConfirm,
  OPTOMETRY_VISIT_ID,
} from './helpers/optometry';

test.describe('Optometry — AS/PS mega-tabs', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test.beforeEach(() => {
    test.skip(!hasOptometryFixture(), 'Set E2E_OPTOMETRY_PATIENT_ID and E2E_OPTOMETRY_VISIT_ID');
  });

  test('smoke: anterior + posterior tabs load save buttons', async ({ page }) => {
    await goOptometryExam(page, 'anterior');
    await expect(page.getByRole('button', { name: 'Save anterior segment' })).toBeVisible();

    await clickExamTab(page, 'posterior');
    await expect(page.getByRole('button', { name: 'Save posterior segment' })).toBeVisible();
  });

  test('smoke: reload preserves exam page after tab navigation', async ({ page }) => {
    await goOptometryExam(page, 'anterior');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Save anterior segment' })).toBeVisible({
      timeout: 60_000,
    });

    await clickExamTab(page, 'posterior');
    await expect(page).toHaveURL(/tab=posterior/);
    await page.reload();
    await goOptometryExam(page, 'posterior');
  });

  /** Scenario 10 — red eye chief complaint banner */
  test('scenario 10: red eye banner on anterior tab', async ({ page }) => {
    await goOptometryExam(page, 'anterior', { complaint: 'red eye' });
    await expect(page.getByText(/Red eye noted on chief complaint/i)).toBeVisible();
  });

  /** Scenario 7 — mobile pill nav */
  test('scenario 7: mobile viewport shows tab pills', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goOptometryExam(page, 'anterior');
    await expect(page.getByRole('button', { name: /^Anterior$/i })).toBeVisible();
    await clickExamTab(page, 'posterior');
    await expect(page.getByRole('button', { name: 'Save posterior segment' })).toBeVisible();
  });

  /** Scenario 6 — copy / mark-normal toolbar present */
  test('scenario 6: section toolbar has copy and mark-normal actions', async ({ page }) => {
    await goOptometryExam(page, 'anterior');
    await expect(page.getByRole('button', { name: 'Copy OD → OS' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mark all normal/i }).first()).toBeVisible();
  });

  /** Scenario 6b — mark-normal OD confirms when section already has OS values */
  test('scenario 6b: mark normal OD shows confirm and applies normals', async ({ page }) => {
    let dialogSeen = false;
    page.on('dialog', (dialog) => {
      dialogSeen = true;
      expect(dialog.message()).toMatch(/already has recorded values/i);
      dialog.accept();
    });

    await goOptometryExam(page, 'posterior');
    await markMaculaOdNormalWithConfirm(page);

    expect(dialogSeen).toBe(true);
    await expect(page.getByRole('button', { name: 'Macular Edema OD' })).toContainText('Absent');
    await expect(page.getByRole('button', { name: 'Macular Edema OS' })).toContainText('Mild');
  });

  /** A2.4 — save buttons reachable on AS then PS (full persist needs filled pupil; smoke = UI + navigation) */
  test('smoke: AS then PS save buttons after tab switch', async ({ page }) => {
    await goOptometryExam(page, 'anterior');
    await expect(page.getByRole('button', { name: 'Save anterior segment' })).toBeEnabled();
    await clickExamTab(page, 'posterior');
    await expect(page.getByRole('button', { name: 'Save posterior segment' })).toBeVisible();
    await page.reload();
    await goOptometryExam(page, 'posterior');
  });

  /**
   * A2.4 — full persist: pupil → save AS (2 keys) → PS field → save PS (4 keys) → reload hydrates.
   * Requires live API + visit fixtures (E2E_OPTOMETRY_PATIENT_ID / E2E_OPTOMETRY_VISIT_ID).
   */
  test('A2.4: AS pupil save then PS overview save survives reload', async ({ page }) => {
    test.setTimeout(90_000);

    await goOptometryExam(page, 'anterior');
    await fillRequiredPupilExam(page);

    await page.getByRole('button', { name: 'Save anterior segment' }).click();
    await expect(page.getByText('Anterior segment saved')).toBeVisible({ timeout: 15_000 });

    await clickExamTab(page, 'posterior');
    await expect(page.getByRole('button', { name: 'Save posterior segment' })).toBeVisible();

    const mediaClarity = 'Hazy';
    await fillPosteriorOverviewField(page, mediaClarity);
    await page.getByRole('button', { name: 'Save posterior segment' }).click();
    await expect(page.getByText('Posterior segment saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await goOptometryExam(page, 'posterior');

    await expandSection(page, 'Fundus overview', 'ps-section-overview');
    await expect(page.getByRole('button', { name: 'Media Clarity OD' })).toContainText(mediaClarity);

    await clickExamTab(page, 'anterior');
    await expandSection(page, 'Pupil examination', 'as-section-pupil');
    await expect(page.getByRole('button', { name: 'Size in Light (mm) OD' })).toContainText('3mm');
    await expect(page.getByRole('button', { name: 'Size in Light (mm) OS' })).toContainText('3mm');

    // Fixture id for manual matrix sign-off
    expect(OPTOMETRY_VISIT_ID).toBeTruthy();
  });
});
