import { type Page, expect } from '@playwright/test';



export const OPTOMETRY_PATIENT_ID = process.env.E2E_OPTOMETRY_PATIENT_ID ?? '';

export const OPTOMETRY_VISIT_ID = process.env.E2E_OPTOMETRY_VISIT_ID ?? '';



export function hasOptometryFixture(): boolean {

  return Boolean(OPTOMETRY_PATIENT_ID && OPTOMETRY_VISIT_ID);

}



export function optometryExamUrl(tab: 'anterior' | 'posterior' = 'anterior', extra?: Record<string, string>) {

  const params = new URLSearchParams({

    patientId: OPTOMETRY_PATIENT_ID,

    visitId: OPTOMETRY_VISIT_ID,

    tab,

    ...extra,

  });

  return `/dashboard/optometrist/exam?${params.toString()}`;

}



const TAB_SAVE_LABEL: Record<'anterior' | 'posterior', RegExp> = {
  anterior: /Save anterior segment/i,
  posterior: /Save posterior segment/i,
};

/** Click Anterior / Posterior tab pill (full or short label). */
export async function clickExamTab(page: Page, tab: 'anterior' | 'posterior') {
  const pattern = tab === 'anterior' ? /Anterior/i : /Posterior/i;
  await page.getByRole('button', { name: pattern }).first().click();
}

export async function goOptometryExam(page: Page, tab: 'anterior' | 'posterior' = 'anterior', extra?: Record<string, string>) {
  await page.goto(optometryExamUrl(tab, extra));
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const saveBtn = page.getByRole('button', { name: TAB_SAVE_LABEL[tab] });
  if (!(await saveBtn.isVisible().catch(() => false))) {
    await clickExamTab(page, tab);
  }
  await expect(saveBtn).toBeVisible({ timeout: 60_000 });
}



/** Pick an option from ExamSelectField popover (aria-label on trigger button). */
export async function pickExamSelect(page: Page, ariaLabel: string, option: string) {
  await page.getByRole('button', { name: ariaLabel, exact: true }).click();
  const popover = page.locator('[data-state="open"]').last();
  await popover.getByRole('button', { name: option, exact: true }).click();
}

/** Expand an AS/PS section card by title if collapsed. Prefer anchor id when nav duplicates the title. */
export async function expandSection(page: Page, title: string, anchorId?: string) {
  const scope = anchorId ? page.locator(`#${anchorId}`) : page;
  const header = scope.getByRole('button', { name: title, exact: true }).first();
  if ((await header.getAttribute('aria-expanded')) === 'false') {
    await header.click();
  }
}



/** Fill all required pupil fields for AS save (scenario 2 / A2.4). */

export async function fillRequiredPupilExam(page: Page) {

  await pickExamSelect(page, 'Size in Light (mm) OD', '3mm');

  await pickExamSelect(page, 'Size in Light (mm) OS', '3mm');

  await pickExamSelect(page, 'Size in Dark (mm) OD', '4mm');

  await pickExamSelect(page, 'Size in Dark (mm) OS', '4mm');

  await pickExamSelect(page, 'Shape OD', 'Round');

  await pickExamSelect(page, 'Shape OS', 'Round');

  await pickExamSelect(page, 'Direct Light Reaction OD', 'Brisk');

  await pickExamSelect(page, 'Direct Light Reaction OS', 'Brisk');

  await pickExamSelect(page, 'Consensual Reaction OD', 'Brisk');

  await pickExamSelect(page, 'Consensual Reaction OS', 'Brisk');

}



/** Expand PS section card and set media clarity OD (minimal PS persist). */
export async function fillPosteriorOverviewField(page: Page, value = 'Hazy') {
  await expandSection(page, 'Fundus overview', 'ps-section-overview');
  await pickExamSelect(page, 'Media Clarity OD', value);
}

/** Scenario 6b — fill OS-only value in Macula, mark-normal OD with confirm. */
export async function markMaculaOdNormalWithConfirm(page: Page, osFieldLabel = 'Macular Edema OS', osValue = 'Mild') {
  await expandSection(page, 'Macula', 'ps-section-macula');
  await pickExamSelect(page, osFieldLabel, osValue);
  const macula = page.locator('#ps-section-macula');
  await macula.getByRole('button', { name: 'Mark all normal — OD' }).click();
}
