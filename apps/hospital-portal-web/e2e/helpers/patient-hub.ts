import { type APIRequestContext, type Page, expect } from '@playwright/test';
import { patientLookupTestIds } from '../../src/lib/patients/patient-lookup-test-ids';
import { PATIENT_HUB_PREVIEW_MODE_KEY } from '../../src/lib/patients/patient-hub-preview-mode';
import { E2E_API_BASE, apiHeaders, type LoginPayload } from './auth';

/** Default branch from E2E admin user (India Eye Hospital Network). */
export const E2E_BRANCH_ID =
  process.env.E2E_TEST_BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';

type LookupPage = {
  totalCount?: number;
  items?: { id: string }[];
};

/** Ensure at least `minCount` patients appear in hub lookup for the E2E branch. */
export async function ensureHubPatients(
  request: APIRequestContext,
  login: LoginPayload,
  minCount = 1,
): Promise<void> {
  const headers = apiHeaders(login.accessToken);

  const lookupRes = await request.get(
    `${E2E_API_BASE}/patients/lookup?branchId=${E2E_BRANCH_ID}&page=1&pageSize=${Math.max(minCount, 25)}`,
    { headers },
  );

  let existing = 0;
  if (lookupRes.ok()) {
    const data = (await lookupRes.json()) as LookupPage;
    existing = data.totalCount ?? data.items?.length ?? 0;
    if (existing >= minCount) return;
  }

  const needed = Math.max(minCount - existing, minCount);
  const stamp = Date.now();

  for (let i = 0; i < needed; i++) {
    const suffix = `${stamp}${i}`;
    const createRes = await request.post(`${E2E_API_BASE}/patients`, {
      headers,
      data: {
        firstName: 'E2E',
        lastName: `HubPatient${suffix}`,
        dateOfBirth: '1990-06-15',
        gender: 'male',
        contactNumber: `+9198765${String(suffix).slice(-5).padStart(5, '0')}`,
        email: `e2e.hub.${suffix}@example.com`,
      },
    });

    if (!createRes.ok()) {
      const body = await createRes.text();
      console.warn(`ensureHubPatients: create failed (${createRes.status()}): ${body}`);
    }
  }
}

export async function ensureHubPatientsOrSkip(
  request: APIRequestContext,
  login: LoginPayload,
  minCount = 1,
): Promise<boolean> {
  await ensureHubPatients(request, login, minCount);

  const headers = apiHeaders(login.accessToken);
  const lookupRes = await request.get(
    `${E2E_API_BASE}/patients/lookup?branchId=${E2E_BRANCH_ID}&page=1&pageSize=${minCount}`,
    { headers },
  );
  expect(lookupRes.ok()).toBeTruthy();
  const data = (await lookupRes.json()) as LookupPage;
  const count = data.totalCount ?? data.items?.length ?? 0;
  return count >= minCount;
}

export async function gotoPatientHub(page: Page): Promise<void> {
  await page.goto('/dashboard/patients', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
    timeout: 60_000,
  });
}

export async function expectHubTable(page: Page): Promise<void> {
  await expect(page.getByTestId(patientLookupTestIds.table)).toBeVisible({
    timeout: 60_000,
  });
}

export async function openFirstHubRow(page: Page): Promise<string> {
  const firstRow = page.locator('[data-testid^="patient-hub-row-"]').first();
  await expect(firstRow).toBeVisible();
  const rowTestId = await firstRow.getAttribute('data-testid');
  const patientId = rowTestId?.replace('patient-hub-row-', '') ?? '';
  expect(patientId).toBeTruthy();
  await firstRow.click();
  return patientId;
}

/** Preview may render as docked split pane (xl+) or floating drawer. */
export async function expectPreviewVisible(page: Page): Promise<void> {
  const drawer = page.getByTestId(patientLookupTestIds.previewDrawer);
  const split = page.getByTestId(patientLookupTestIds.previewSplitPane);
  const panel = page.getByTestId(patientLookupTestIds.previewPanel);
  await expect(drawer.or(split).or(panel)).toBeVisible({ timeout: 15_000 });
}

export async function seedHubPreviewMode(
  page: Page,
  mode: 'docked' | 'floating',
): Promise<void> {
  await page.addInitScript((storageKey, value) => {
    window.localStorage.setItem(storageKey, value);
  }, PATIENT_HUB_PREVIEW_MODE_KEY, mode);
}

export async function openFirstPatientRecord(page: Page): Promise<void> {
  await gotoPatientHub(page);
  await expectHubTable(page);
  await openFirstHubRow(page);
  await expectPreviewVisible(page);
  await page.getByTestId(patientLookupTestIds.previewOpenProfile).click();
  await expect(page.getByTestId(patientLookupTestIds.recordShell)).toBeVisible({
    timeout: 60_000,
  });
}
