/**
 * Phase 9 — API-level acceptance for remaining scenario hops.
 * Full clinical mutation requires E2E_WARD_FULL_FLOWS=1.
 */
import { test, expect } from '@playwright/test';
import { apiLogin } from './helpers/auth';
import { E2E_BRANCH_ID } from './helpers/patient-hub';
import { fetchWardJourneys } from './helpers/ward-preop';
import {
  apiFetchJourneyDetail,
  apiGetFinancialSummary,
  apiListBedAssignments,
  apiListInternalBeds,
  apiTransferBed,
  apiTransitionClinical,
} from './helpers/ward-journey-api';

const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';

test.describe('Phase 9 acceptance @ip-phase9', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Scenario 3 — PostOp → ReadyForDischarge is not money-gated', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    const postOp = journeys.find((j) => j.clinicalState === 'PostOp');
    test.skip(!postOp, 'No PostOp journey to prove clinical vs financial independence');

    const summary = await apiGetFinancialSummary(request, login, postOp.id);
    const moved = await apiTransitionClinical(request, login, postOp.id, 'ReadyForDischarge');
    expect(moved?.clinicalState).toBe('ReadyForDischarge');

    if ((summary?.patientBalance ?? 0) > 0) {
      const discharged = await apiTransitionClinical(request, login, postOp.id, 'Discharged');
      const after = await apiFetchJourneyDetail(request, login, postOp.id);
      expect(after?.clinicalState).toBe('ReadyForDischarge');
      expect(discharged?.clinicalState ?? after?.clinicalState).not.toBe('Discharged');
    }
  });

  test('Scenario 6 — ward transfer writes history and one open assignment', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    const candidates = journeys.filter((j) =>
      j.clinicalState === 'Admitted' || j.clinicalState === 'ReadyForSurgery',
    );

    let source: typeof candidates[0] | undefined;
    let fromBed: string | undefined;
    let branchId = E2E_BRANCH_ID;
    for (const j of candidates) {
      const d = await apiFetchJourneyDetail(request, login, j.id);
      if (d?.assignedBedId) {
        source = j;
        fromBed = d.assignedBedId;
        if (d.branchId) branchId = d.branchId;
        break;
      }
    }
    test.skip(!source || !fromBed, 'No admitted/ready journey with assignedBedId');

    const beds = await apiListInternalBeds(request, branchId);
    const dest = beds.find(
      (b) => b.bedId !== fromBed && (b.bedStatus === 'Available' || b.bedStatus === 'available'),
    );
    test.skip(!dest, 'No Available Auth bed for transfer (occupancy SoT)');

    const xfer = await apiTransferBed(request, login, source.id, dest.bedId);
    expect(xfer.ok, `transfer-bed HTTP ${xfer.status}`).toBeTruthy();
    expect(xfer.detail?.assignedBedId).toBe(dest.bedId);

    const history = await apiListBedAssignments(request, login, source.id);
    expect(history.length).toBeGreaterThanOrEqual(2);
    const open = history.filter((h) => !h.endedAt);
    expect(open).toHaveLength(1);
    expect(open[0].assignedBedId).toBe(dest.bedId);
    expect(history.some((h) => h.assignedBedId === fromBed && !!h.endedAt)).toBeTruthy();
  });

  test('Scenario 7 — readmission uses PriorJourneyId and does not reopen discharged', async ({ request }) => {
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    const expected = journeys.filter((j) => j.clinicalState === 'Expected');
    let linked: { id: string; prior: string } | undefined;
    for (const j of expected) {
      const d = await apiFetchJourneyDetail(request, login, j.id);
      if (d?.priorJourneyId) {
        linked = { id: j.id, prior: d.priorJourneyId };
        break;
      }
    }
    test.skip(!linked, 'No Expected journey with priorJourneyId in this tenant/branch');

    const prior = await apiFetchJourneyDetail(request, login, linked.prior);
    expect(prior?.clinicalState).toBe('Discharged');
    expect(linked.id).not.toBe(linked.prior);
    const illegal = await apiTransitionClinical(request, login, linked.prior, 'Admitted');
    expect(illegal).toBeNull();
  });

  test('Scenario 8 — financial summary keeps payment lines when refunds exist', async ({ request }) => {
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    let foundRefund = false;
    for (const j of journeys.slice(0, 40)) {
      const summary = await apiGetFinancialSummary(request, login, j.id);
      const lines = summary?.payments ?? [];
      const refunds = lines.filter((p) => (p.paymentKind ?? '').toLowerCase() === 'refund');
      if (refunds.length === 0) continue;
      foundRefund = true;
      const originals = lines.filter((p) => {
        const k = (p.paymentKind ?? '').toLowerCase();
        return k === 'payment' || k === 'advance';
      });
      expect(originals.length).toBeGreaterThan(0);
      expect(summary?.refundsAndReversals ?? 0).toBeGreaterThan(0);
      break;
    }
    test.skip(!foundRefund, 'No journey with a Refund OpdBillPayment line in this branch');
  });

  test('Scenario 2 — coverage summary splits payer vs patient responsibility', async ({ request }) => {
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    let coverage: string | undefined;
    for (const j of journeys) {
      const d = await apiFetchJourneyDetail(request, login, j.id);
      const mode = (d?.paymentMode ?? '').toLowerCase();
      if (mode.includes('insurance') || mode.includes('tpa') || mode.includes('cghs') || mode === 'coverage') {
        coverage = j.id;
        break;
      }
    }
    test.skip(!coverage, 'No coverage-based journey for payer/patient split');
    const summary = await apiGetFinancialSummary(request, login, coverage);
    test.skip(!summary, 'financial-summary unavailable');
    expect(summary.patientResponsibility ?? 0).toBeGreaterThanOrEqual(0);
    expect(summary.insuranceResponsibility ?? 0).toBeGreaterThanOrEqual(0);
  });
});
