/**
 * Phase 5 P1 — CCMS/IP integration helpers for Playwright journeys.
 */
import { type APIRequestContext } from '@playwright/test';
import { E2E_TENANT_ID, apiHeaders, type LoginPayload } from './auth';
import { E2E_IP_API_BASE } from './ward-preop';

export const E2E_CCMS_API_BASE = (
  process.env.E2E_CCMS_API_URL
  ?? process.env.NEXT_PUBLIC_CCMS_API_URL
  ?? 'http://localhost:7075/api'
).replace(/\/$/, '');

export const E2E_INTERNAL_KEY =
  process.env.E2E_INTERNAL_API_KEY
  ?? process.env.AuthService__InternalApiKey
  ?? 'hp-internal-svc-key-change-in-production-2026';

export interface PreauthStatusApi {
  allowed: boolean;
  warningLevel: string;
  warningMessage?: string | null;
  blockReason?: string | null;
  caseId?: string | null;
  decision?: string | null;
  coverageState?: string | null;
  paymentMode?: string | null;
  ccmsUnavailable?: boolean;
}

export async function apiGetPreauthStatus(
  request: APIRequestContext,
  login: LoginPayload,
  journeyId: string,
): Promise<PreauthStatusApi | null> {
  const res = await request.get(
    `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/financial/preauth-status`,
    { headers: apiHeaders(login.accessToken) },
  );
  if (!res.ok()) return null;
  return (await res.json()) as PreauthStatusApi;
}

export interface CcmsCaseRow {
  id: string;
  caseNumber?: string;
  currentState?: string;
  journeyId?: string | null;
  sessionId?: string | null;
}

function pickGuid(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function normalizeCaseRow(raw: Record<string, unknown>): CcmsCaseRow | null {
  const id = pickGuid(raw, 'id', 'Id');
  if (!id) return null;
  return {
    id,
    caseNumber: (raw.caseNumber ?? raw.CaseNumber) as string | undefined,
    currentState: (raw.currentState ?? raw.CurrentState) as string | undefined,
    journeyId: pickGuid(raw, 'journeyId', 'JourneyId'),
    sessionId: pickGuid(raw, 'sessionId', 'SessionId'),
  };
}

export async function apiListCcmsCases(
  request: APIRequestContext,
  login: LoginPayload,
  state?: string,
): Promise<CcmsCaseRow[]> {
  const params: Record<string, string> = { page: '1', pageSize: '50' };
  if (state) params.state = state;
  const res = await request.get(`${E2E_CCMS_API_BASE}/ccms/coverage-cases`, {
    headers: apiHeaders(login.accessToken),
    params,
  });
  if (!res.ok()) return [];
  const json = await res.json();
  const rows = Array.isArray(json)
    ? json
    : (json.cases ?? json.Cases ?? json.items ?? json.Items ?? []);
  return (rows as Record<string, unknown>[]).map(normalizeCaseRow).filter((r): r is CcmsCaseRow => r != null);
}

export async function apiGetCcmsCase(
  request: APIRequestContext,
  login: LoginPayload,
  caseId: string,
): Promise<CcmsCaseRow | null> {
  const res = await request.get(`${E2E_CCMS_API_BASE}/ccms/coverage-cases/${caseId}`, {
    headers: apiHeaders(login.accessToken),
  });
  if (!res.ok()) return null;
  return normalizeCaseRow((await res.json()) as Record<string, unknown>);
}

export async function apiListEnhancementsForCase(
  request: APIRequestContext,
  login: LoginPayload,
  caseId: string,
): Promise<Array<{ id: string; status?: string }>> {
  const res = await request.get(
    `${E2E_CCMS_API_BASE}/ccms/coverage-cases/${caseId}/enhancements`,
    { headers: apiHeaders(login.accessToken) },
  );
  if (!res.ok()) return [];
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json.items ?? json.Items ?? [];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? r.Id ?? ''),
    status: String(r.status ?? r.Status ?? ''),
  })).filter((r) => r.id);
}

export async function apiGetBillingFull(
  request: APIRequestContext,
  login: LoginPayload,
  caseId: string,
): Promise<{ summary?: { id?: string }; allocationCount: number } | null> {
  const res = await request.get(
    `${E2E_CCMS_API_BASE}/ccms/coverage-cases/${caseId}/billing/full`,
    { headers: apiHeaders(login.accessToken) },
  );
  if (!res.ok() || res.status() === 204) return { allocationCount: 0 };
  const raw = (await res.text()).trim();
  if (!raw) return { allocationCount: 0 };
  const json = JSON.parse(raw) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary) as Record<string, unknown> | undefined;
  const allocations = (json.allocations ?? json.Allocations) as unknown[] | undefined;
  const id = summary ? String(summary.id ?? summary.Id ?? '') : '';
  return {
    summary: id ? { id } : undefined,
    allocationCount: Array.isArray(allocations) ? allocations.length : 0,
  };
}

export async function apiListClaimsForCase(
  request: APIRequestContext,
  login: LoginPayload,
  caseId: string,
): Promise<unknown[]> {
  const res = await request.get(
    `${E2E_CCMS_API_BASE}/ccms/coverage-cases/${caseId}/claims`,
    { headers: apiHeaders(login.accessToken) },
  );
  if (!res.ok()) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

export async function apiAllocateBill(
  request: APIRequestContext,
  login: LoginPayload,
  caseId: string,
  totalBillAmount: number,
  billId?: string,
): Promise<number> {
  const res = await request.post(
    `${E2E_CCMS_API_BASE}/ccms/coverage-cases/${caseId}/billing/allocate`,
    {
      headers: { ...apiHeaders(login.accessToken), 'Content-Type': 'application/json' },
      data: { billId: billId ?? crypto.randomUUID(), totalBillAmount },
    },
  );
  return res.status();
}

export async function apiGenerateClaim(
  request: APIRequestContext,
  login: LoginPayload,
  caseId: string,
  claimedAmount: number,
): Promise<number> {
  const res = await request.post(
    `${E2E_CCMS_API_BASE}/ccms/coverage-cases/${caseId}/claims`,
    {
      headers: { ...apiHeaders(login.accessToken), 'Content-Type': 'application/json' },
      data: { claimedAmount, claimType: 'final', submissionMode: 'portal' },
    },
  );
  return res.status();
}

export async function postBillFinalized(
  request: APIRequestContext,
  payload: {
    journeyId?: string;
    sessionId?: string;
    billId?: string;
    totalAmount?: number;
  },
  idempotencyKey: string,
): Promise<number> {
  const res = await request.post(`${E2E_CCMS_API_BASE}/ccms/integration/bill-finalized`, {
    headers: {
      'X-Internal-Key': E2E_INTERNAL_KEY,
      'X-Tenant-ID': E2E_TENANT_ID,
      'X-Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
    },
    data: payload,
  });
  return res.status();
}

export function isCoverageBasedMode(mode?: string | null): boolean {
  if (!mode) return false;
  const m = mode.trim().toLowerCase();
  return [
    'insurance', 'tpa', 'copay', 'cghs', 'sghs', 'governmentscheme',
    'esi', 'esh', 'arograshree', 'railway',
  ].includes(m);
}
