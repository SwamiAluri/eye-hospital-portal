/**

 * E2E: Ward Pre-Operative Workspace (Phases 4–9)

 *

 * Spec: docs/ward-preop-workspace-spec.md §14

 *

 * Smoke tests run against live API + ward journeys when present.

 * Full multi-step clinical flows require:

 *   E2E_WARD_FULL_FLOWS=1

 *   npm run resolve:e2e:ward  (Expected + Admitted + ReadyForSurgery journeys)

 *

 * Run:

 *   npm run test:e2e:ward-preop

 */

import { test, expect } from '@playwright/test';

import { loginAsRole, apiLogin } from './helpers/auth';

import { COUNSELLING_SESSION_ID } from './helpers/counselling';

import {
  WARD_PREOP_TEST_IDS,
  WARD_PREOP_V2_TEST_IDS,
} from '../src/lib/ip-management/ward-preop-test-ids';

import {

  admitViaModal,

  apiGetCounsellorPreOpInvestigations,

  apiGetPacAssessment,

  apiSaveCounsellorPreOpInvestigation,

  apiSavePacAssessment,

  apiSaveInvestigationResult,

  apiVerifyInvestigation,

  closeWorkspace,

  completePacWithUnverifiedWarning,

  confirmConsentItem,

  enterNpoTime,

  expandPacAccordion,

  fillPacRequiredFields,

  enterInvestigationValue,

  ensureInvestigationVerified,

  expectInvestigationVerifyHidden,

  expectWorkspaceOpen,

  fetchWardInvestigationChecklist,

  fetchWardJourneys,

  findExpectedJourneyForSession,

  findInvestigationItem,

  findJourneyByState,

  gotoWardPage,

  navigateChecklistSection,

  navigateStep,

  openCareRecords,

  openWorkspaceForFirstJourneyInTab,

  openWorkspaceForJourney,

  resolveWardFixtures,

  selectWardStatusTab,

} from './helpers/ward-preop';



const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';



test.describe('Ward Pre-Op Workspace @ip-ward-preop', () => {

  test.describe.configure({ timeout: 120_000 });



  test.beforeEach(async ({ page }) => {

    await loginAsRole(page, 'nurse');

    await gotoWardPage(page);

  });



  test('ward page loads with status tabs and journey table', async ({ page }) => {

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('Expected'))).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('Admitted'))).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('ReadyForSurgery'))).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardQueueTab('need'))).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardQueueTab('ward'))).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardViewList)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardViewFloor)).toBeVisible();

  });



  test('workspace is an accessible dialog: role/aria-modal, print link, Escape closes (Phase 12)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);

    // Dialog semantics for screen readers.

    const dialog = workspace.getByRole('dialog');

    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);

    // Print pre-op summary deep-link is present and opens the print route.

    const printLink = page.getByTestId(WARD_PREOP_TEST_IDS.printSummary);
    if (await printLink.count()) {
      await expect(printLink).toHaveAttribute('href', /\/summary\/print$/);
    }

    await page.keyboard.press('Escape');

    await expect(workspace).toHaveCount(0);

  });



  test('readiness bar surfaces the rollup verdict + per-step counts at the top (Phase 13)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);

    // Sticky readiness bar replaces the legacy footer gate chip / phase strip.

    const bar = workspace.getByTestId(WARD_PREOP_TEST_IDS.readinessBar);

    await expect(bar).toBeVisible();

    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.readinessSummary)).toContainText(/steps ready/i);

    // Investigations is unlocked pre-admit; rail shows the full step label (counts live in the readiness bar).

    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.stepTab('investigations'))).toContainText('Investigations');

    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.stepTabCount('investigations'))).toHaveCount(0);

  });



  test('ward workspace does not show legacy Form 1/2/3/4 labels', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);

    await expect(workspace).not.toContainText(/\(Form [0-9]\)/);

    await expect(workspace).not.toContainText(/Form 1/);

    await expect(workspace).not.toContainText(/Form 2/);

    await expect(workspace).not.toContainText(/Form 3/);

    await expect(workspace).not.toContainText(/Form 4/);

  });



  test('Expected row opens unified workspace at investigations (PreOpChecklistModal parity)', async ({

    page,

  }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch — schedule OT counselling first');



    await expect(page.getByText('Ward Pre-Operative Workspace')).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionInvestigations)).toBeVisible();

    // Admission is its own "Admit Patient" rail step (below Pre-OT Prep).
    await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('admit')).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitModal)).toBeVisible();

  });



  test('Expected workspace hides care tabs until admitted (G8)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);
    const recordsTab = page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('records'));
    if (await recordsTab.isVisible().catch(() => false)) {
      await navigateStep(page, 'records');
    }
    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.careTab('vitals'))).toHaveCount(0);
    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.careTab('medLog'))).toHaveCount(0);
    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.stepNav)).toBeVisible();
    await expect(workspace.getByText(/open once the patient is admitted/i)).toBeVisible();

  });



  test('Expected workspace uses compact gate chip, not full banner (G7)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);

    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.gateBannerWarnings)).toHaveCount(0);

    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.gateBannerClear)).toHaveCount(0);

  });



  test('Admitted workspace shows separate PAC and Anaesthesia clearance steps', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    await navigateStep(page, 'pac');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionPac)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacAnaesthesiaClearance)).toBeVisible();

  });



  test('Admitted row opens workspace with vitals tab and mark-ready action', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    await navigateStep(page, 'records');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.careTab('vitals'))).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.btnMarkReady)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.markReadyFooter)).toBeVisible();

  });



  test('ReadyForSurgery row shows send-to-OT footer action', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'ReadyForSurgery');

    test.skip(!journeyId, 'No ReadyForSurgery journey in branch');



    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.btnSendOt)).toBeVisible();

  });



  test('step nav navigates the pre-op workflow', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    await navigateStep(page, 'investigations');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionInvestigations)).toBeVisible();



    await navigateStep(page, 'evaluation');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionClearance)).toBeVisible();



    await navigateStep(page, 'pac');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionPac)).toBeVisible();

  });



  test('Consent step is the single consent writer; signing satisfies derived ticks (Phase 5)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    await navigateStep(page, 'consent');

    const panel = page.getByTestId(WARD_PREOP_TEST_IDS.consentPanel);

    await expect(panel).toBeVisible();

    // No generic department-clearance accordion is rendered for Consent anymore.

    await expect(panel.getByTestId(WARD_PREOP_TEST_IDS.sectionClearance)).toHaveCount(0);



    // Signing the surgical consent writer auto-satisfies the §3 bedside derived ticks.

    await confirmConsentItem(page, 'surgery_consent_signed');

    await expect(

      page.getByTestId(WARD_PREOP_V2_TEST_IDS.derivedTick('consent_patient_signed')),

    ).toHaveAttribute('aria-disabled', 'true');

  });



  test('Coverage & Payment Status step shows CCMS projection (Phase 1)', async ({ page }) => {
    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');
    test.skip(!journeyId, 'No Expected journey in branch');

    await navigateStep(page, 'financial');
    const panel = page.getByTestId(WARD_PREOP_TEST_IDS.financialPanel);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: /Coverage & Payment Status/i })).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialSummary)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialBalance)).toBeVisible();
    // No generic department-clearance accordion for this step.
    await expect(panel.getByTestId(WARD_PREOP_TEST_IDS.sectionClearance)).toHaveCount(0);
    // Canonical pre-auth is not ward-editable (no checkbox toggle).
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialToggle('insurance_preauth_approved'))).toHaveCount(0);
    // Payment mode is derived (counselling) — not a writer toggle.
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialToggle('payment_mode_confirmed'))).toHaveCount(0);
  });



  test('Fasting NPO time drives duration + fasting-confirmed (Phase 7)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    await navigateStep(page, 'fasting');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.fastingPanel)).toBeVisible();



    // The NPO writer is persisted; the server derives duration + fasting confirmed.

    await enterNpoTime(page, 8);

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.fastingDuration)).not.toHaveText('—');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.fastingConfirmedChip)).toContainText(/confirmed/i);

  });



  test('Clinical Evaluation shows locked preview before admission', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    await navigateStep(page, 'evaluation');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.clinicalEvalPanel)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.clinicalEvalSignoff)).toBeVisible();

    await expect(page.getByText(/unlocks once the patient is admitted/i)).toBeVisible();

  });



  test('Clinical Evaluation structured form renders when admitted (Phase 5)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    await navigateStep(page, 'evaluation');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.clinicalEvalForm)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.clinicalEvalDiagnosis)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.clinicalEvalSignoff)).toBeVisible();

  });



  test('PAC investigation summary deep-links to Investigations + vitals reference shows (Phase 9)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    await navigateStep(page, 'pac');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionPac)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacVitalsReference)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacAnaesthesiaClearance)).toBeVisible();

    await page.getByTestId(WARD_PREOP_TEST_IDS.pacInvestigationEditLink).click();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.stepPanel('investigations'))).toBeVisible();

  });



  test('PAC API save persists scalar and jsonb fields', async ({ request }) => {

    const login = await apiLogin(request);

    const fixtures = await resolveWardFixtures(request, login);

    test.skip(!fixtures.admitted, 'No Admitted journey');



    const save = await apiSavePacAssessment(request, login, fixtures.admitted!.id);

    expect(save.ok, save.error ?? 'PAC save failed').toBe(true);

    expect(save.anaesthesiaPlan).toBe('Local');



    const loaded = await apiGetPacAssessment(request, login, fixtures.admitted!.id);

    expect(loaded?.bp).toBe('120/80');

    expect(loaded?.anaesthesiaPlan).toBe('Local');

  });



  test('Nursing & Records rail label + activity audit drawer (Phase 9)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    const workspace = page.getByTestId(WARD_PREOP_TEST_IDS.workspace);

    await expect(workspace.getByTestId(WARD_PREOP_TEST_IDS.stepTab('records'))).toContainText(/Nursing/i);



    await workspace.getByTestId(WARD_PREOP_TEST_IDS.auditDrawerToggle).click();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.auditDrawer)).toBeVisible();

  });



  test('Pre-OT Prep shows only nurse acts and keeps them editable when admitted (Option B)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    await navigateStep(page, 'bedside');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionWardSafety)).toBeVisible();

    // Only the true nurse bedside acts render — the derived WHO sign-in/readiness mirrors
    // were removed (owned by their source steps + the OT Surgical Safety Checklist).

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.bedsideNurseGroup)).toBeVisible();

    await expect(

      page.getByTestId(WARD_PREOP_V2_TEST_IDS.derivedTick('patient_identity_confirmed')),

    ).toHaveCount(0);

    // Nurse-action rows stay editable when admitted (true bedside acts).

    await expect(

      page.getByTestId(WARD_PREOP_TEST_IDS.bedsideNurseToggle('preop_medication_given')),

    ).toBeVisible();

  });



  test('Locked dept category hides its item list pre-admit + unified status chip (Phase 11)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    await navigateStep(page, 'evaluation');

    // Single unified status vocabulary: the locked chip uses the Phase-1 StatusChip.

    const statusCell = page.getByTestId(WARD_PREOP_TEST_IDS.sectionDisplayStatus('Evaluation'));

    await expect(statusCell).toHaveText(/Locked until admission/i);

    // Locked category item list is not rendered pre-admit.

    await expect(page.getByText(/clearance items appear after admission/i)).toBeVisible();

  });



  test('Admit step renders the inline admit panel for Expected journey (G7)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

    test.skip(!journeyId, 'No Expected journey in branch');



    await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('admit')).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitModal)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitSubmit)).toBeVisible();

  });



  test('PAC section shows read-only investigation summary (no lab grid)', async ({ page }) => {

    const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Admitted');

    test.skip(!journeyId, 'No Admitted journey in branch');



    await navigateChecklistSection(page, 'pac');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacSection('reference'))).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacInvestigationSummary)).toBeVisible();

  });



  test.describe('Counsellor draft → ward', () => {

    test('counsellor API draft appears on ward as unverified', async ({ page, request }) => {

      const login = await apiLogin(request);

      const journeys = await fetchWardJourneys(request, login);

      const sessionId = COUNSELLING_SESSION_ID || undefined;

      test.skip(!sessionId, 'Set E2E_COUNSELLING_SESSION_ID (npm run resolve:e2e:ward)');



      const expected =

        findExpectedJourneyForSession(journeys, sessionId)

        ?? findJourneyByState(journeys, 'Expected');

      test.skip(!expected, 'No Expected journey linked to counselling session');



      const preChecklist = await fetchWardInvestigationChecklist(request, login, expected.id);

      const preItem = findInvestigationItem(preChecklist, 'blood_sugar');

      test.skip(
        preItem?.entryStatus === 'entered' || preItem?.entryStatus === 'verified',
        'blood_sugar already entered on ward — reset fixture for counsellor draft test',
      );



      const counsellorItems = await apiGetCounsellorPreOpInvestigations(request, login, sessionId);

      const bloodSugar = counsellorItems.find((i) => i.itemKey === 'couns_preop_blood_sugar');

      test.skip(!bloodSugar, 'couns_preop_blood_sugar not in counsellor catalog');



      const saved = await apiSaveCounsellorPreOpInvestigation(

        request,

        login,

        sessionId,

        bloodSugar.itemId,

        '105',

      );

      expect(saved).toBeTruthy();



      await fetchWardInvestigationChecklist(request, login, expected.id);



      await gotoWardPage(page);

      await openWorkspaceForJourney(page, expected.id);

      await navigateChecklistSection(page, 'investigations');



      const row = page.getByTestId(WARD_PREOP_TEST_IDS.investigationRow('blood_sugar'));

      test.skip(!(await row.isVisible().catch(() => false)), 'blood_sugar row not in ward catalog');



      await expect(row.getByText(/counsellor draft/i)).toBeVisible({ timeout: 15_000 });

      await expectInvestigationVerifyHidden(page, 'blood_sugar');



      const checklist = await fetchWardInvestigationChecklist(request, login, expected.id);

      const item = findInvestigationItem(checklist, 'blood_sugar');

      expect(item?.resultValue).toBe('105');

      expect(item?.entryStatus).toBe('draft');

    });

  });



  test('Expected: enter blood sugar value and save', async ({ page, request }) => {

    const login = await apiLogin(request);

    const journeys = await fetchWardJourneys(request, login);

    const expected = findJourneyByState(journeys, 'Expected');

    test.skip(!expected, 'No Expected journey in branch');



    await gotoWardPage(page);

    await selectWardStatusTab(page, 'Expected');

    await openWorkspaceForJourney(page, expected.id);

    await navigateChecklistSection(page, 'investigations');



    const row = page.getByTestId(WARD_PREOP_TEST_IDS.investigationRow('blood_sugar'));

    test.skip(!(await row.isVisible().catch(() => false)), 'blood_sugar row not in catalog');



    await enterInvestigationValue(page, 'blood_sugar', '112');

    await expect(row.getByText(/entered|counsellor draft|verified|pending/i)).toBeVisible({

      timeout: 15_000,

    });

  });



  test.describe('Full clinical flows', () => {

    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1 with seeded journeys (npm run resolve:e2e:ward)');



    test('Expected: investigation → verify → admit modal', async ({ page, request }) => {

      const login = await apiLogin(request);

      const fixtures = await resolveWardFixtures(request, login);

      test.skip(!fixtures.expected, 'No Expected journey');



      await ensureInvestigationVerified(request, login, fixtures.expected!.id, 'blood_sugar', '98');

      await gotoWardPage(page);

      await openWorkspaceForJourney(page, fixtures.expected!.id);

      await admitViaModal(page);

      await expect(page.getByTestId(WARD_PREOP_TEST_IDS.workspace)).toBeVisible();

    });



    test('Admitted: vitals → PAC summary → med log', async ({ page, request }) => {

      const login = await apiLogin(request);

      const fixtures = await resolveWardFixtures(request, login);

      test.skip(!fixtures.admitted, 'No Admitted journey');



      await gotoWardPage(page);

      await openWorkspaceForJourney(page, fixtures.admitted!.id);

      await openCareRecords(page, 'vitals');

      await page.getByTestId(WARD_PREOP_TEST_IDS.careTab('medLog')).click();

      await navigateChecklistSection(page, 'pac');

      await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacSection('reference'))).toBeVisible();
      await expect(page.getByTestId(WARD_PREOP_TEST_IDS.pacInvestigationSummary)).toBeVisible();

    });



    test('Admitted: PAC complete warns on unverified critical labs', async ({ page, request }) => {

      const login = await apiLogin(request);

      const fixtures = await resolveWardFixtures(request, login);

      test.skip(!fixtures.admitted, 'No Admitted journey');



      const checklist = await fetchWardInvestigationChecklist(request, login, fixtures.admitted!.id);

      const creatinine = findInvestigationItem(checklist, 'serum_creatinine');

      if (creatinine) {

        await apiSaveInvestigationResult(

          request,

          login,

          fixtures.admitted!.id,

          creatinine.itemId,

          '1.3',

          'mg/dL',

        );

      }



      await gotoWardPage(page);

      await openWorkspaceForJourney(page, fixtures.admitted!.id);

      await navigateChecklistSection(page, 'pac');

      const pacSection = page.getByTestId(WARD_PREOP_TEST_IDS.sectionPac);

      test.skip(
        await pacSection.getByText('Completed').isVisible().catch(() => false),
        'PAC already completed on admitted journey',
      );

      await fillPacRequiredFields(page);

      await completePacWithUnverifiedWarning(page);

      await expect(page.getByText(/PAC completed/i)).toBeVisible({ timeout: 15_000 });

    });



    test('ReadyForSurgery: send to OT action opens modal', async ({ page, request }) => {

      const login = await apiLogin(request);

      const fixtures = await resolveWardFixtures(request, login);

      test.skip(!fixtures.ready, 'No ReadyForSurgery journey');



      await gotoWardPage(page);

      await openWorkspaceForJourney(page, fixtures.ready!.id);

      await page.getByTestId(WARD_PREOP_TEST_IDS.btnSendOt).click();

      await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sendToOtModal)).toBeVisible();

    });

  });



  test.describe('Regression — legacy modal entry points', () => {

    test('row click replaces separate PreOpChecklistModal / WardUpdationModal', async ({ page }) => {

      const journeyId = await openWorkspaceForFirstJourneyInTab(page, 'Expected');

      test.skip(!journeyId, 'No Expected journey');



      await expect(page.getByTestId(WARD_PREOP_TEST_IDS.workspace)).toHaveCount(1);

      await closeWorkspace(page);

    });

  });

});


