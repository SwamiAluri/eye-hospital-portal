import { type APIRequestContext, expect } from '@playwright/test';
import { E2E_IP_API_BASE, type WardJourneySummary } from './ward-preop';
import { E2E_TENANT_ID, apiHeaders, type LoginPayload } from './auth';

export interface JourneyDetailApi {
  id: string;
  clinicalState: string;
  otState: string;
  patientId?: string;
  eyeOperated?: string | null;
  pendingRebook?: boolean;
  otFinalizeScheduleId?: string | null;
  surgeryScheduledAt?: string | null;
  surgeryCancelledAt?: string | null;
  cancelledFromState?: string | null;
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
