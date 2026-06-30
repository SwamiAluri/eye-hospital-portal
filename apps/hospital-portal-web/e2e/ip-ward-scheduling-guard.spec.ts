/**
 * E2E: G6 — same-day single-eye scheduling guard
 *
 * - ip-management: apply-rebook rejects conflicting surgery date (JourneySchedulingGuardService)
 * - auth-service: OT prepare rejects second single-eye same day (OtFinalizeService)
 *
 * Env:
 *   E2E_WARD_FULL_FLOWS=1
 *   E2E_INTERNAL_API_KEY — for apply-rebook tests
 *   E2E_G6_PREPARED_SCHEDULE_ID + E2E_G6_CANDIDATE_SCHEDULE_ID + E2E_G6_SURGERY_DATE — optional pinned OT prepare test
 */
import { test, expect } from '@playwright/test';
import { apiLogin } from './helpers/auth';
import { E2E_BRANCH_ID } from './helpers/patient-hub';
import { fetchWardJourneys } from './helpers/ward-preop';
import {
  apiApplyCounsellingRebookRaw,
  apiFetchJourneyDetail,
  type JourneyDetailWithPatient,
} from './helpers/ward-journey-api';
import { apiPrepareOtList } from './helpers/counselling-ot-api';

const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';
const HAS_INTERNAL_KEY = Boolean(
  process.env.E2E_INTERNAL_API_KEY ?? process.env.AuthService__InternalApiKey,
);

const SINGLE_EYE = new Set(['OD', 'OS', 'RE', 'LE', 'RIGHT', 'LEFT']);

function isSingleEye(eye: string | null | undefined): boolean {
  if (!eye) return false;
  const e = eye.trim().toUpperCase();
  if (e === 'BE' || e === 'OU' || e === 'BOTH' || e === 'BOTH_EYES') return false;
  return SINGLE_EYE.has(e) || e.length <= 2;
}

function surgeryDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

async function loadJourneyDetails(
  request: import('@playwright/test').APIRequestContext,
  login: Awaited<ReturnType<typeof apiLogin>>,
): Promise<JourneyDetailWithPatient[]> {
  const rows = await fetchWardJourneys(request, login, E2E_BRANCH_ID);
  const details: JourneyDetailWithPatient[] = [];
  for (const row of rows) {
    const detail = await apiFetchJourneyDetail(request, login, row.id);
    if (detail) details.push(detail as JourneyDetailWithPatient);
  }
  return details;
}

/** Find two active single-eye journeys for the same patient (different eyes). */
function findSingleEyePair(
  details: JourneyDetailWithPatient[],
): { target: JourneyDetailWithPatient; conflictDate: string } | null {
  const active = details.filter(
    (j) => j.clinicalState !== 'Discharged' && j.otFinalizeScheduleId && j.surgeryScheduledAt,
  );

  const byPatient = new Map<string, JourneyDetailWithPatient[]>();
  for (const j of active) {
    if (!j.patientId) continue;
    const list = byPatient.get(j.patientId) ?? [];
    list.push(j);
    byPatient.set(j.patientId, list);
  }

  for (const journeys of byPatient.values()) {
    if (journeys.length < 2) continue;
    const singles = journeys.filter((j) => isSingleEye(j.eyeOperated));
    if (singles.length < 2) continue;

    const [a, b] = singles;
    const conflictDate = surgeryDay(a.surgeryScheduledAt);
    if (!conflictDate) continue;
    if (surgeryDay(b.surgeryScheduledAt) === conflictDate) continue;

    return { target: b, conflictDate };
  }

  return null;
}

test.describe('G6 same-day single-eye scheduling guard @ip-ward-scheduling-guard', () => {
  test('apply-rebook blocks same-day second single-eye journey', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');
    test.skip(!HAS_INTERNAL_KEY, 'Set E2E_INTERNAL_API_KEY for internal journey-sync');

    const login = await apiLogin(request);
    const details = await loadJourneyDetails(request, login);
    const pair = findSingleEyePair(details);
    test.skip(!pair, 'Need two single-eye journeys for same patient on different dates');

    const { target, conflictDate } = pair;
    test.skip(!target.otFinalizeScheduleId, 'Target journey missing otFinalizeScheduleId');

    const conflictIso = `${conflictDate}T10:00:00.000Z`;
    const result = await apiApplyCounsellingRebookRaw(
      request,
      target.otFinalizeScheduleId!,
      conflictIso,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.message ?? '').toMatch(/single-eye|scheduling blocked/i);
  });

  test('OT prepare blocks second single-eye on same day (pinned schedules)', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');

    const preparedId = process.env.E2E_G6_PREPARED_SCHEDULE_ID?.trim();
    const candidateId = process.env.E2E_G6_CANDIDATE_SCHEDULE_ID?.trim();
    const surgeryDate = process.env.E2E_G6_SURGERY_DATE?.trim();
    test.skip(
      !preparedId || !candidateId || !surgeryDate,
      'Set E2E_G6_PREPARED_SCHEDULE_ID, E2E_G6_CANDIDATE_SCHEDULE_ID, E2E_G6_SURGERY_DATE',
    );

    const login = await apiLogin(request);
    const result = await apiPrepareOtList(request, login, surgeryDate, [candidateId]);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.message ?? '').toMatch(/single-eye|scheduling blocked/i);
  });
});
