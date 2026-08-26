import { type APIRequestContext, expect } from '@playwright/test';
import { E2E_IP_API_BASE, type WardJourneySummary } from './ward-preop';
import { E2E_API_BASE, E2E_TENANT_ID, apiHeaders, type LoginPayload } from './auth';

export interface JourneyDetailApi {
  id: string;
  clinicalState: string;
  otState: string;
  patientId?: string;
  branchId?: string;
  paymentMode?: string | null;
  counselingSessionId?: string | null;
  eyeOperated?: string | null;
  pendingRebook?: boolean;
  otFinalizeScheduleId?: string | null;
  surgeryScheduledAt?: string | null;
  surgeryCancelledAt?: string | null;
  cancelledFromState?: string | null;
  assignedBedId?: string | null;
  priorJourneyId?: string | null;
  emergencyFcApplied?: boolean;
  opdBillId?: string | null;
}

export interface JourneyBedAssignmentApi {
  id: string;
  assignedBedId?: string | null;
  assignmentType?: string;
  endedAt?: string | null;
  startedAt?: string;
}

export interface AuthIpPaymentLineApi {
  id: string;
  paymentKind?: string | null;
  amount: number;
}

export interface AuthIpFinancialSummaryApi {
  opdBillId?: string | null;
  billedAmount?: number;
  totalCollected?: number;
  refundsAndReversals?: number;
  patientBalance?: number;
  insuranceResponsibility?: number;
  patientResponsibility?: number;
  payments?: AuthIpPaymentLineApi[];
}

function actorUserId(login: LoginPayload): string | undefined {
  const u = login.user;
  const id = u.id ?? u.Id ?? u.userId ?? u.UserId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function ipHeaders(token: string): Record<string, string> {
  return apiHeaders(token);
}

/** Fix legacy helper path — clinical-transition is the canonical route. */
export async function apiTransitionClinical(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  newState: string,
  acknowledgeWarnings = true,
): Promise<JourneyDetailApi | null> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/clinical-transition`,
    {
      headers: ipHeaders(login.accessToken),
      data: { newState, acknowledgeWarnings },
    },
  );
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

export async function apiFetchJourneyDetail(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyDetailApi | null> {
  const res = await request.get(`${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}`, {
    headers: ipHeaders(login.accessToken),
  });
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

export async function apiCancelTodaySurgery(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  reason: string,
): Promise<JourneyDetailApi | null> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/cancel-today-surgery`,
    {
      headers: ipHeaders(login.accessToken),
      data: { reason },
    },
  );
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

/** Phase 1: explicit ward Rebook — CancelledSurgery → Expected. */
export async function apiRebookCancelledSurgery(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyDetailApi | null> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/rebook`,
    { headers: ipHeaders(login.accessToken) },
  );
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

export async function apiApplyCounsellingRebook(
  request: APIRequestContext,
  otScheduleId: string,
  surgeryScheduledAt: string,
  actorUserId?: string,
): Promise<JourneyDetailApi | null> {
  const internalKey = process.env.E2E_INTERNAL_API_KEY ?? process.env.AuthService__InternalApiKey ?? '';
  if (!internalKey) return null;

  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/internal/journey-sync/apply-rebook`,
    {
      headers: {
        'X-Internal-Key': internalKey,
        'Content-Type': 'application/json',
      },
      data: {
        otScheduleId,
        tenantId: E2E_TENANT_ID,
        surgeryScheduledAt,
        actorUserId: actorUserId ?? 'e2e',
      },
    },
  );
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

/** apply-rebook for G6 scheduling-guard negative tests. */
export async function apiApplyCounsellingRebookRaw(
  request: APIRequestContext,
  otScheduleId: string,
  surgeryScheduledAt: string,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const internalKey = process.env.E2E_INTERNAL_API_KEY ?? process.env.AuthService__InternalApiKey ?? '';
  if (!internalKey) return { ok: false, status: 0, message: 'Missing E2E_INTERNAL_API_KEY' };

  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/internal/journey-sync/apply-rebook`,
    {
      headers: {
        'X-Internal-Key': internalKey,
        'Content-Type': 'application/json',
      },
      data: {
        otScheduleId,
        tenantId: E2E_TENANT_ID,
        surgeryScheduledAt,
        actorUserId: 'e2e',
      },
    },
  );
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  return {
    ok: res.ok(),
    status: res.status(),
    message: body.error ?? body.message,
  };
}

export interface JourneyDetailWithPatient extends JourneyDetailApi {}

export async function apiAcceptInOt(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyDetailApi | null> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/accept`,
    {
      headers: ipHeaders(login.accessToken),
      params: { acknowledgeWarnings: true },
      data: {},
    },
  );
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

export async function apiSaveBeforeAnaesthesiaWithBillingOverride(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<boolean> {
  const res = await request.put(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/surgical-safety/before-anaesthesia`,
    {
      headers: ipHeaders(login.accessToken),
      data: {
        identityConfirmed: true,
        eyeRe: true,
        eyeLe: false,
        topicalAntibioticsUsed: true,
        surgeryType: 'Phaco',
        billingVerifiedOverride: true,
        ascanVerified: true,
        allergyKnown: false,
        allergyDetails: null,
        consentFormChecked: true,
        fitnessConfirmed: true,
      },
    },
  );
  return res.ok();
}

export async function apiSaveWhoTimeout(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<boolean> {
  const uid = actorUserId(login);
  const res = await request.put(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/surgical-safety/who-timeout`,
    {
      headers: ipHeaders(login.accessToken),
      data: {
        patientIdentity: true,
        correctEye: true,
        correctProcedure: true,
        consentConfirmed: true,
        surgeonUserId: uid ?? null,
        nurseUserId: uid ?? null,
      },
    },
  );
  return res.ok();
}

/** Billing override + WHO + Accept so Start Surgery can enter InOT. */
export async function apiPrepareAcceptedInOt(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyDetailApi | null> {
  await apiSaveBeforeAnaesthesiaWithBillingOverride(request, login, journeyId);
  await apiSaveWhoTimeout(request, login, journeyId);
  await apiAcceptInOt(request, login, journeyId);
  return apiFetchJourneyDetail(request, login, journeyId);
}

export async function apiTransferBed(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
  assignedBedId: string,
  reason = 'Phase 9 E2E ward transfer',
): Promise<{ ok: boolean; status: number; detail: JourneyDetailApi | null }> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/transfer-bed`,
    {
      headers: ipHeaders(login.accessToken),
      data: { assignedBedId, reason },
    },
  );
  const detail = res.ok() ? ((await res.json()) as JourneyDetailApi) : null;
  return { ok: res.ok(), status: res.status(), detail };
}

export async function apiListBedAssignments(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyBedAssignmentApi[]> {
  const res = await request.get(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/bed-assignments`,
    { headers: ipHeaders(login.accessToken) },
  );
  if (!res.ok()) return [];
  const json = await res.json();
  return Array.isArray(json) ? (json as JourneyBedAssignmentApi[]) : [];
}

export async function apiGetFinancialSummary(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<AuthIpFinancialSummaryApi | null> {
  const res = await request.get(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/financial-summary`,
    { headers: ipHeaders(login.accessToken) },
  );
  if (!res.ok()) return null;
  return (await res.json()) as AuthIpFinancialSummaryApi;
}

export async function apiListInternalBeds(
  request: APIRequestContext,
  branchId: string,
): Promise<Array<{ bedId: string; bedStatus?: string }>> {
  const internalKey =
    process.env.E2E_INTERNAL_API_KEY
    ?? process.env.AuthService__InternalApiKey
    ?? 'hp-internal-svc-key-change-in-production-2026';
  const res = await request.get(`${E2E_API_BASE}/internal/ip-beds`, {
    headers: { 'X-Internal-Key': internalKey },
    params: { tenantId: E2E_TENANT_ID, branchId },
  });
  if (!res.ok()) return [];
  const json = await res.json();
  const rows = Array.isArray(json) ? json : [];
  return rows.map((r: Record<string, unknown>) => ({
    bedId: String(r.bedId ?? r.BedId ?? ''),
    bedStatus: String(r.bedStatus ?? r.BedStatus ?? ''),
  })).filter((b) => b.bedId);
}

export async function apiStartSurgery(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyDetailApi | null> {
  const res = await request.post(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/start-surgery`,
    {
      headers: ipHeaders(login.accessToken),
      params: { acknowledgeWhoWarning: true },
      data: {},
    },
  );
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

export async function apiUpdateOtDetails(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<JourneyDetailApi | null> {
  const res = await request.put(`${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/ot`, {
    headers: ipHeaders(login.accessToken),
    data: {
      anaesthetistName: 'E2E Anaesthetist',
      operationTheatreName: 'OT-1',
      anaesthesiaType: 'Local',
      primarySurgeonId: null,
    },
  });
  if (!res.ok()) return null;
  return (await res.json()) as JourneyDetailApi;
}

export async function apiPrepareJourneyForOtFlow(
  request: APIRequestContext,
  login: LoginPayload,
  journey: WardJourneySummary,
): Promise<JourneyDetailApi | null> {
  let detail = await apiFetchJourneyDetail(request, login, journey.id);
  if (!detail) return null;

  if (detail.clinicalState === 'ReadyForSurgery') {
    detail = await apiTransitionClinical(request, login, journey.id, 'SentToOT');
  }

  if (!detail || detail.clinicalState !== 'SentToOT') return detail;

  if (!detail.otState || detail.otState === 'NotSent') {
    detail = await apiFetchJourneyDetail(request, login, journey.id);
  }

  await apiUpdateOtDetails(request, login, journey.id);
  return apiFetchJourneyDetail(request, login, journey.id);
}

export function expectJourneyState(
  detail: JourneyDetailApi | null,
  clinical: string,
  ot?: string,
): void {
  expect(detail).not.toBeNull();
  expect(detail!.clinicalState).toBe(clinical);
  if (ot) expect(detail!.otState).toBe(ot);
}
