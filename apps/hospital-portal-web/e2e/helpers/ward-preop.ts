import { type APIRequestContext, type Page, expect } from '@playwright/test';
import {
  WARD_PREOP_TEST_IDS,
  WARD_PREOP_V2_TEST_IDS,
} from '../../src/lib/ip-management/ward-preop-test-ids';
import { COUNSELLING_PREOP_TEST_IDS } from '../../src/lib/counsellors-desk/counselling-preop-test-ids';
import { E2E_API_BASE, apiHeaders, type LoginPayload } from './auth';
import { E2E_BRANCH_ID } from './patient-hub';
import { goToPhase, counsellingSessionUrl } from './counselling';

export type WardClinicalState = 'Expected' | 'Admitted' | 'ReadyForSurgery';

export const E2E_IP_API_BASE = (
  process.env.E2E_IP_MANAGEMENT_API_URL
  ?? process.env.NEXT_PUBLIC_IP_MANAGEMENT_API_URL
  ?? 'http://localhost:5074/api'
).replace(/\/$/, '');

export interface WardJourneySummary {
  id: string;
  patientName: string | null;
  clinicalState: string;
  uhid: string | null;
  counselingSessionId?: string | null;
}

export interface WardE2EFixtures {
  expected?: WardJourneySummary;
  admitted?: WardJourneySummary;
  ready?: WardJourneySummary;
  fullFlowsReady: boolean;
}

export interface WardInvestigationItemApi {
  itemId: string;
  itemKey: string;
  entryStatus: string;
  resultValue: string | null;
  counsellorDraft?: boolean;
}

function ipApiHeaders(token: string): Record<string, string> {
  return apiHeaders(token);
}

function journeyIdFromEnv(state: WardClinicalState): string | undefined {
  const key =
    state === 'Expected'
      ? 'E2E_WARD_EXPECTED_JOURNEY_ID'
      : state === 'Admitted'
        ? 'E2E_WARD_ADMITTED_JOURNEY_ID'
        : 'E2E_WARD_READY_JOURNEY_ID';
  return process.env[key]?.trim() || undefined;
}

export async function fetchWardJourneys(
  request: APIRequestContext,
  login: LoginPayload,
  branchId = E2E_BRANCH_ID,
): Promise<WardJourneySummary[]> {
  const res = await request.get(`${E2E_IP_API_BASE}/ip-management/journeys`, {
    headers: ipApiHeaders(login.accessToken),
    params: { branchId },
  });
  if (!res.ok()) return [];
  const rows = (await res.json()) as WardJourneySummary[];
  return Array.isArray(rows) ? rows : [];
}

export function findJourneyByState(
  journeys: WardJourneySummary[],
  state: WardClinicalState,
): WardJourneySummary | undefined {
  const envId = journeyIdFromEnv(state);
  if (envId) {
    const match = journeys.find((j) => j.id === envId);
    if (match) return match;
  }
  return journeys.find((j) => j.clinicalState === state);
}

export async function resolveWardFixtures(
  request: APIRequestContext,
  login: LoginPayload,
): Promise<WardE2EFixtures> {
  const journeys = await fetchWardJourneys(request, login);
  const expected = findJourneyByState(journeys, 'Expected');
  const admitted = findJourneyByState(journeys, 'Admitted');
  const ready = findJourneyByState(journeys, 'ReadyForSurgery');
  return {
    expected,
    admitted,
    ready,
    fullFlowsReady: Boolean(expected && admitted && ready),
  };
}

export async function fetchWardInvestigationChecklist(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<{ items: WardInvestigationItemApi[] } | null> {
  const res = await request.get(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/ward-investigation-checklist`,
    { headers: ipApiHeaders(login.accessToken) },
  );
  if (!res.ok()) return null;
  return (await res.json()) as { items: WardInvestigationItemApi[] };
}

export function findInvestigationItem(
  checklist: { items: WardInvestigationItemApi[] } | null,
  itemKey: string,
): WardInvestigationItemApi | undefined {
  return checklist?.items.find((i) => i.itemKey === itemKey);
}

export async function apiSaveInvestigationResult(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  itemId: string,
  resultValue: string,
  resultUnit?: string,
): Promise<boolean> {
  const res = await request.put(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}/result`,
    {
      headers: ipApiHeaders(login.accessToken),
      data: {
        resultValue,
        resultUnit: resultUnit ?? null,
        resultSource: 'manual_ward',
      },
    },
  );
  return res.ok();
}

export async function apiVerifyInvestigation(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  itemId: string,
): Promise<boolean> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}/verify`,
    {
      headers: ipApiHeaders(login.accessToken),
      data: {},
    },
  );
  return res.ok();
}

export async function apiFetchWards(
  request: APIRequestContext,
  login: LoginPayload,
  branchId = E2E_BRANCH_ID,
): Promise<Array<{ id: string; wardName: string }>> {
  const res = await request.get(`${E2E_IP_API_BASE}/ip-management/wards`, {
    headers: ipApiHeaders(login.accessToken),
    params: { branchId },
  });
  if (!res.ok()) return [];
  const rows = (await res.json()) as Array<{ id: string; wardName: string }>;
  return Array.isArray(rows) ? rows : [];
}

export async function apiAdmitPatient(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  wardId?: string,
): Promise<{ clinicalState: string } | null> {
  const wards = await apiFetchWards(request, login);
  const resolvedWardId = wardId ?? wards[0]?.id;
  const res = await request.post(`${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/admit`, {
    headers: ipApiHeaders(login.accessToken),
    data: {
      wardId: resolvedWardId,
      admissionType: 'DayCare',
      acknowledgeWarnings: true,
    },
  });
  if (!res.ok()) return null;
  const json = (await res.json()) as { clinicalState: string };
  return json;
}

export async function apiTransitionClinical(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  newState: string,
): Promise<boolean> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/clinical-transition`,
    {
      headers: ipApiHeaders(login.accessToken),
      data: { newState, acknowledgeWarnings: true },
    },
  );
  return res.ok();
}

export async function apiSaveCounsellorPreOpInvestigation(
  request: APIRequestContext,
  login: LoginPayload,
  sessionId: string,
  itemId: string,
  resultValue: string,
): Promise<boolean> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/counsellor/sessions/${sessionId}/pre-op-investigations/${itemId}`,
    {
      headers: ipApiHeaders(login.accessToken),
      data: { resultValue, resultUnit: 'mg/dL' },
    },
  );
  return res.ok();
}

export async function apiGetCounsellorPreOpInvestigations(
  request: APIRequestContext,
  login: LoginPayload,
  sessionId: string,
): Promise<Array<{ itemId: string; itemKey: string }>> {
  const res = await request.get(
    `${E2E_IP_API_BASE}/ip-management/counsellor/sessions/${sessionId}/pre-op-investigations`,
    { headers: ipApiHeaders(login.accessToken) },
  );
  if (!res.ok()) return [];
  const json = (await res.json()) as { items?: Array<{ itemId: string; itemKey: string }> };
  return json.items ?? [];
}

export async function apiSavePacAssessment(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<{ ok: boolean; anaesthesiaPlan?: string; error?: string }> {
  const res = await request.put(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/pac-assessment`,
    {
      headers: ipApiHeaders(login.accessToken),
      data: {
        bp: '120/80',
        hr: 72,
        physicalStatusAsa: 2,
        anaesthesiaPlan: 'Local',
        consentType: 'Written',
        airwayExam: { mallampati: 2, mouthOpening: 'Normal' },
        systemicReview: { cvs: 'NAD', respiratory: 'NAD' },
      },
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    anaesthesiaPlan?: string;
    error?: string;
  };
  if (!res.ok()) {
    return { ok: false, error: body.error ?? res.statusText() };
  }
  return { ok: true, anaesthesiaPlan: body.anaesthesiaPlan };
}

export async function apiGetPacAssessment(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<{ bp?: string; anaesthesiaPlan?: string; error?: string } | null> {
  const res = await request.get(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/pac-assessment`,
    { headers: ipApiHeaders(login.accessToken) },
  );
  if (!res.ok()) return null;
  return (await res.json()) as { bp?: string; anaesthesiaPlan?: string; error?: string };
}

export function findExpectedJourneyForSession(
  journeys: WardJourneySummary[],
  sessionId: string,
): WardJourneySummary | undefined {
  return journeys.find(
    (j) => j.clinicalState === 'Expected' && j.counselingSessionId === sessionId,
  );
}

export async function gotoWardPage(page: Page): Promise<void> {
  await page.goto('/dashboard/ip-management/ward', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardPage)).toBeVisible({
    timeout: 60_000,
  });
}

export async function selectWardStatusTab(
  page: Page,
  tab: WardClinicalState | 'All',
): Promise<void> {
  await page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab(tab)).click();
}

export async function openWorkspaceForJourney(page: Page, journeyId: string): Promise<void> {
  await selectWardStatusTab(page, 'All');
  const row = page.getByTestId(WARD_PREOP_TEST_IDS.wardJourneyRow(journeyId));
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.patientDrawer)).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
  await expectWorkspaceOpen(page);
}

export async function openWorkspaceForFirstJourneyInTab(
  page: Page,
  tab: WardClinicalState,
): Promise<string | null> {
  await selectWardStatusTab(page, tab);
  const row = page.locator(`tr[data-clinical-state="${tab}"]`).first();
  try {
    await row.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    return null;
  }

  const testId = await row.getAttribute('data-testid');
  const journeyId = testId?.replace('ward-journey-row-', '') ?? null;
  await row.click();
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.patientDrawer)).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
  await expectWorkspaceOpen(page);
  return journeyId;
}

export async function expectWorkspaceOpen(page: Page): Promise<void> {
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.workspace)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.stepNav)).toBeVisible();
}

/** Workspace v2 step keys. */
export type WardPreOpStep =
  | 'investigations'
  | 'evaluation'
  | 'pac'
  | 'consent'
  | 'financial'
  | 'fasting'
  | 'bedside'
  | 'records';

export async function navigateStep(page: Page, step: WardPreOpStep): Promise<void> {
  const tab = page.getByTestId(WARD_PREOP_TEST_IDS.stepTab(step));
  await expect(tab).toBeVisible({ timeout: 15_000 });
  await tab.click();
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.stepPanel(step))).toBeVisible();
}

/**
 * Back-compat shim: legacy checklist section names now map to v2 steps.
 * (investigations→①, clearance→② Evaluation, wardSafety→⑦ Bedside, pac→③ PAC)
 */
export async function navigateChecklistSection(
  page: Page,
  section: 'investigations' | 'clearance' | 'wardSafety' | 'pac',
): Promise<void> {
  const step: WardPreOpStep =
    section === 'investigations'
      ? 'investigations'
      : section === 'clearance'
        ? 'evaluation'
        : section === 'wardSafety'
          ? 'bedside'
          : 'pac';

  const panelTestId =
    section === 'investigations'
      ? WARD_PREOP_TEST_IDS.sectionInvestigations
      : section === 'clearance'
        ? WARD_PREOP_TEST_IDS.sectionClearance
        : section === 'wardSafety'
          ? WARD_PREOP_TEST_IDS.sectionWardSafety
          : WARD_PREOP_TEST_IDS.sectionPac;

  await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab(step)).click();
  await expect(page.getByTestId(panelTestId)).toBeVisible();
}

export async function openCareRecords(page: Page, careTab: 'vitals' | 'medLog' | 'nurseRecords' | 'remark' = 'vitals'): Promise<void> {
  await navigateStep(page, 'records');
  await page.getByTestId(WARD_PREOP_TEST_IDS.careTab(careTab)).click();
}

/** Toggle a single ④ Consent & Authorization writer item to complete. */
export async function confirmConsentItem(page: Page, itemKey: string): Promise<void> {
  const toggle = page.getByTestId(WARD_PREOP_TEST_IDS.consentToggle(itemKey));
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== 'true') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
}

/** Toggle a single ⑤ Financial Clearance writer item to complete. */
export async function confirmFinancialItem(page: Page, itemKey: string): Promise<void> {
  const toggle = page.getByTestId(WARD_PREOP_TEST_IDS.financialToggle(itemKey));
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== 'true') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
}

/**
 * Enter the ⑥ NPO last-intake time (hoursAgo before now). Persists the single NPO
 * writer; the SERVER derives fasting duration + "fasting confirmed" from it.
 */
export async function enterNpoTime(page: Page, hoursAgo: number): Promise<void> {
  const input = page.getByTestId(WARD_PREOP_TEST_IDS.fastingNpoInput);
  await expect(input).toBeVisible();
  const when = new Date(Date.now() - hoursAgo * 3_600_000);
  // datetime-local wants YYYY-MM-DDTHH:mm in local time.
  const local = new Date(when.getTime() - when.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await input.fill(local);
  await input.blur();
}

/** Set the ⑥ intake type (clear | light | solid) — adjusts the ASA fasting threshold. */
export async function setNpoIntakeType(
  page: Page,
  type: 'clear' | 'light' | 'solid',
): Promise<void> {
  const select = page.getByTestId(WARD_PREOP_TEST_IDS.fastingIntakeType);
  await expect(select).toBeVisible();
  await select.selectOption(type);
}

export async function closeWorkspace(page: Page): Promise<void> {
  const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);
  const headerClose = workspace.getByLabel('Close workspace');
  if (await headerClose.count()) {
    await headerClose.click();
  } else {
    await workspace.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await expect(workspace).toBeHidden();
}

export function investigationRow(page: Page, itemKey: string) {
  return page.getByTestId(WARD_PREOP_TEST_IDS.investigationRow(itemKey));
}

/** Expand a collapsed investigation row so its editor is visible. */
async function expandInvestigationRow(page: Page, itemKey: string): Promise<void> {
  const row = investigationRow(page, itemKey);
  const toggle = row.getByTestId(WARD_PREOP_TEST_IDS.investigationRowToggle(itemKey));
  if ((await toggle.count()) === 0) return;
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

export async function enterInvestigationValue(
  page: Page,
  itemKey: string,
  value: string,
): Promise<void> {
  const row = investigationRow(page, itemKey);
  await expect(row).toBeVisible();
  await expandInvestigationRow(page, itemKey);

  // v2: auto-save on blur via the shared DataField (no per-row Save button).
  const input = row.getByTestId(WARD_PREOP_V2_TEST_IDS.dataFieldInput(itemKey));
  const hasInput = await input.isVisible().catch(() => false);
  if (!hasInput) {
    await expect(row.getByText(/^(Entered|Verified|Counsellor draft)$/i).first()).toBeVisible({
      timeout: 5_000,
    });
    return;
  }

  await input.fill(value);
  await input.blur();
  await expect(row.getByText(/entered|verified|counsellor draft|pending/i).first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function ensureInvestigationVerified(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  itemKey: string,
  resultValue = '97',
): Promise<void> {
  const checklist = await fetchWardInvestigationChecklist(request, login, journeyId);
  const item = findInvestigationItem(checklist, itemKey);
  if (!item) return;
  if (item.entryStatus === 'verified') return;
  if (item.entryStatus !== 'entered') {
    await apiSaveInvestigationResult(request, login, journeyId, item.itemId, resultValue);
  }
  await apiVerifyInvestigation(request, login, journeyId, item.itemId);
}

export async function verifyInvestigation(page: Page, itemKey: string): Promise<void> {
  const row = investigationRow(page, itemKey);
  const alreadyVerified = await row.getByText('Verified', { exact: true }).first().isVisible().catch(() => false);
  if (alreadyVerified) return;

  // v2: Verify moved into the per-row overflow ActionMenu.
  await row.getByTestId(WARD_PREOP_V2_TEST_IDS.actionMenuButton).click();
  await row.getByTestId(WARD_PREOP_V2_TEST_IDS.actionMenuItem('verify')).click();
  await expect(row.getByText('Verified', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function expectInvestigationVerifyHidden(page: Page, itemKey: string): Promise<void> {
  const row = investigationRow(page, itemKey);
  await expect(row.getByTestId(WARD_PREOP_TEST_IDS.investigationVerify(itemKey))).toHaveCount(0);
  const menuBtn = row.getByTestId(WARD_PREOP_V2_TEST_IDS.actionMenuButton);
  if (!(await menuBtn.isVisible().catch(() => false))) return;
  await menuBtn.click();
  await expect(row.getByTestId(WARD_PREOP_V2_TEST_IDS.actionMenuItem('verify'))).toHaveCount(0);
  await page.keyboard.press('Escape');
}

export async function openCounsellingPreOpInvestigations(page: Page): Promise<void> {
  await expect(page.getByTestId(COUNSELLING_PREOP_TEST_IDS.panel)).toBeVisible({
    timeout: 15_000,
  });
}

export async function saveCounsellorPreOpBloodSugar(
  page: Page,
  value: string,
): Promise<void> {
  await openCounsellingPreOpInvestigations(page);
  const row = page.getByTestId(COUNSELLING_PREOP_TEST_IDS.investigation('couns_preop_blood_sugar'));
  await row.fill(value);
  await page.getByTestId(COUNSELLING_PREOP_TEST_IDS.save).click();
  await expect(page.getByText(/saved \d+ draft investigation/i)).toBeVisible({ timeout: 15_000 });
}

export async function gotoCounsellingWrapup(page: Page, sessionId: string): Promise<void> {
  await page.goto(counsellingSessionUrl(sessionId), { waitUntil: 'domcontentloaded' });
  await goToPhase(page, 'wrapup');
}

export async function ensurePacSectionVisible(page: Page): Promise<void> {
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionPac)).toBeVisible();
}

/** @deprecated PAC is a continuous sheet — use ensurePacSectionVisible */
export async function expandPacAccordion(page: Page, _key?: string): Promise<void> {
  await ensurePacSectionVisible(page);
}

export async function fillPacRequiredFields(page: Page): Promise<void> {
  const pac = page.getByTestId(WARD_PREOP_TEST_IDS.sectionPac);
  const completeBtn = page.getByTestId(WARD_PREOP_TEST_IDS.pacCompleteButton);
  if (await completeBtn.isEnabled().catch(() => false)) return;

  const bp = pac.getByTestId(WARD_PREOP_TEST_IDS.pacFieldBp);
  if ((await bp.inputValue()) !== '120/80') {
    await bp.fill('120/80');
  }
  await bp.blur();

  const hr = pac.getByTestId(WARD_PREOP_TEST_IDS.pacFieldHr);
  if ((await hr.inputValue()) !== '72') {
    await hr.fill('72');
  }
  await hr.blur();

  await pac.getByRole('button', { name: '2', exact: true }).click({ force: true });

  await pac.getByRole('button', { name: 'Local', exact: true }).click({ force: true });
  await pac.getByRole('button', { name: 'Written', exact: true }).click({ force: true });
  await expect(pac.getByText('Ready to complete')).toBeVisible({ timeout: 20_000 });
}

export async function completePacWithUnverifiedWarning(page: Page): Promise<void> {
  const completeBtn = page.getByTestId(WARD_PREOP_TEST_IDS.pacCompleteButton);
  await expect(completeBtn).toBeEnabled({ timeout: 15_000 });
  await completeBtn.click();
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacCompleteWarnDialog)).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId(WARD_PREOP_TEST_IDS.pacCompleteConfirm).click();
  await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacCompleteWarnDialog)).toBeHidden({
    timeout: 15_000,
  });
}

export async function admitViaModal(page: Page, wardName?: RegExp): Promise<void> {
  // Admission is its own rail step ("Admit Patient") below Pre-OT Prep, visible only
  // while Expected (no separate modal, no confirm() — gates are warn-only on the top bar).
  await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('admit')).click();
  const form = page.getByTestId(WARD_PREOP_TEST_IDS.admitModal);
  await expect(form).toBeVisible();

  if (wardName) {
    // Ward is the second <select> in the form (after Surgeon / Doctor).
    const wardSelect = form.locator('select').nth(1);
    if ((await wardSelect.locator('option').count()) > 1) {
      await wardSelect.selectOption({ label: wardName }).catch(() => {});
    }
  }

  await page.getByTestId(WARD_PREOP_TEST_IDS.admitSubmit).click();
  await expect(form).toBeHidden({ timeout: 30_000 });
}
