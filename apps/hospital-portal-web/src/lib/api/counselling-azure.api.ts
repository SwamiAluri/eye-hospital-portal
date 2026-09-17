/**
 * counselling-azure.api.ts
 *
 * HTTP client for the CounsellingApi Azure Functions microservice.
 * Base URL defaults to http://localhost:7071/api (Azure Functions local default).
 * Override via NEXT_PUBLIC_COUNSELLING_API_URL.
 *
 * All methods are fire-and-forget safe — each catches its own errors and logs
 * a console.warn rather than throwing, so an offline CounsellingApi never
 * breaks the existing auth-service + mock-data workflow.
 */

import axios, { AxiosInstance } from 'axios';
import { attachAuthRequestInterceptor, attachAuthResponseInterceptor } from '../auth-interceptors';
import { useAuthStore } from '../auth-store';

const COUNSELLING_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_COUNSELLING_API_URL) ||
  'http://localhost:7071/api';

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;
  _client = axios.create({ baseURL: COUNSELLING_API_URL });
  attachAuthRequestInterceptor(_client);
  // Fire-and-forget enrichment: never bounce the counsellor desk to Access Denied.
  attachAuthResponseInterceptor(_client, { skipForbiddenRedirect: true });

  return _client;
}

function resolvePerformedBy(override?: string): string {
  return override ?? useAuthStore.getState().user?.userName ?? 'system';
}

function resolveTenantId(override?: string): string {
  return override ?? useAuthStore.getState().tenantId ?? '00000000-0000-0000-0000-000000000000';
}

/**
 * Maps UI decision values to the state-machine values expected by CounsellingApi.
 * 'DateForSurgery' (patient agreed to book) → 'Interested'
 * 'Interested' / 'NotInterested' → pass-through
 */
export function mapDecision(decision: string): string {
  return decision === 'NotInterested' ? 'NotInterested' : 'Interested';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceOverrideRecord {
  id: string;
  variantId: string;
  variantName: string;
  basePrice: number;
  overriddenPrice: number;
  priceType: string;
  reason: string;
  remarks?: string | null;
  requestedByType: string;
  requestedByName?: string | null;
  createdAt: string;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const counsellingAzureApi = {
  /**
   * Transition the patient record Pending → Processed and lock it.
   * Creates a new record if none exists for this patient.
   * Returns { id } on success, null on failure.
   */
  async start(
    patientId: string,
    tenantId?: string,
    performedBy?: string,
  ): Promise<{ id: string } | null> {
    try {
      const res = await getClient().post(`/counselling/start/${patientId}`, {
        tenantId: resolveTenantId(tenantId),
        performedBy: resolvePerformedBy(performedBy),
      });
      return res.data as { id: string };
    } catch (err) {
      console.warn('[CounsellingAzure] start — non-blocking failure:', err);
      return null;
    }
  },

  /**
   * Persist package selection without changing the workflow state.
   */
  async save(
    id: string,
    data: {
      packageId?: string;
      packageDetails?: string;
      paymentType?: string;
      insuranceCompany?: string;
      performedBy?: string;
    },
  ): Promise<void> {
    try {
      await getClient().put(`/counselling/${id}/save`, {
        ...data,
        performedBy: resolvePerformedBy(data.performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] save — non-blocking failure:', err);
    }
  },

  /**
   * Record the patient's decision.
   * decision: Interested | NotInterested | NeedsTime
   * NeedsTime is sent as-is — the backend maps it to RepeatCounselling.
   * Also used from Done state to transition Done → RepeatCounselling.
   */
  async decision(
    id: string,
    decision: string,
    performedBy?: string,
    followUpDate?: string,
    followUpReason?: string,
  ): Promise<void> {
    try {
      await getClient().post(`/counselling/${id}/decision`, {
        decision,
        followUpDate,
        followUpReason,
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] decision — non-blocking failure:', err);
    }
  },

  /**
   * Set a tentative surgery / follow-up date.
   * scheduledDate must be an ISO 8601 date string (e.g. 2026-06-15).
   */
  async schedule(id: string, scheduledDate: string, performedBy?: string): Promise<void> {
    try {
      await getClient().post(`/counselling/${id}/schedule`, {
        scheduledDate,
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] schedule — non-blocking failure:', err);
    }
  },

  /**
   * Update the selected surgery package on the record.
   */
  async updatePackage(
    id: string,
    packageId: string,
    packageDetails?: string,
    performedBy?: string,
  ): Promise<void> {
    try {
      await getClient().put(`/counselling/${id}/package`, {
        packageId,
        packageDetails,
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] updatePackage — non-blocking failure:', err);
    }
  },

  /**
   * Re-open a Done session for procedure change (Done → Processed).
   */
  async reEvaluate(id: string, performedBy?: string): Promise<void> {
    try {
      await getClient().post(`/counselling/${id}/re-evaluate`, {
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] reEvaluate — non-blocking failure:', err);
    }
  },

  /**
   * Transition Done → AddOnSurgery when a price override or package upgrade
   * is applied after the original Done decision.
   */
  async addOnSurgery(id: string, reason?: string, performedBy?: string): Promise<void> {
    try {
      await getClient().post(`/counselling/${id}/add-on-surgery`, {
        reason,
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] addOnSurgery — non-blocking failure:', err);
    }
  },

  /** Lock the record against concurrent edits. */
  async lock(id: string, performedBy?: string): Promise<void> {
    try {
      await getClient().post(`/counselling/${id}/lock`, {
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] lock — non-blocking failure:', err);
    }
  },

  /** Release a lock. */
  async unlock(id: string, performedBy?: string): Promise<void> {
    try {
      await getClient().post(`/counselling/${id}/unlock`, {
        performedBy: resolvePerformedBy(performedBy),
      });
    } catch (err) {
      console.warn('[CounsellingAzure] unlock — non-blocking failure:', err);
    }
  },

  /**
   * Retrieve a paginated list of counselling records.
   */
  async getList(query?: {
    tenantId?: string;
    patientId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const res = await getClient().get('/counselling', { params: query });
      return res.data;
    } catch {
      return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
  },

  /** Record a counsellor price override for the session. */
  async addPriceOverride(
    id: string,
    payload: {
      variantId: string;
      variantName: string;
      basePrice: number;
      overriddenPrice: number;
      priceType: string;
      reason: string;
      remarks?: string;
      requestedByType: 'SELF' | 'STAFF';
      requestedByUserId?: string;
      requestedByName?: string;
      requestedByContact?: string;
      performedBy: string;
      tenantId: string;
    },
  ): Promise<void> {
    await getClient().post(`/counselling/${id}/price-overrides`, payload);
  },

  /** Soft-delete a single price override by its own UUID. */
  async removePriceOverride(sessionId: string, overrideId: string): Promise<void> {
    await getClient().delete(`/counselling/${sessionId}/price-overrides/${overrideId}`, {
      params: { performedBy: 'counsellor' },
    });
  },

  /** Edit an existing price override (price, reason, remarks only). */
  async updatePriceOverride(
    sessionId: string,
    overrideId: string,
    payload: { overriddenPrice: number; reason: string; remarks?: string; performedBy?: string },
  ): Promise<void> {
    await getClient().patch(`/counselling/${sessionId}/price-overrides/${overrideId}`, {
      overriddenPrice: payload.overriddenPrice,
      reason: payload.reason,
      remarks: payload.remarks,
      performedBy: payload.performedBy ?? 'counsellor',
    });
  },

  /** Retrieve all price overrides recorded for a session. */
  async getPriceOverrides(id: string): Promise<PriceOverrideRecord[]> {
    try {
      const res = await getClient().get(`/counselling/${id}/price-overrides`);
      return (res.data ?? []) as PriceOverrideRecord[];
    } catch {
      return [];
    }
  },

  /**
   * Returns the full audit trail for a counselling session, newest entry first.
   * Powers the Session History modal in the counsellor's desk.
   */
  async getHistory(id: string): Promise<import('@/types/counsellors-desk').SessionAuditEntry[]> {
    try {
      const res = await getClient().get(`/counselling/${id}/history`);
      return (res.data ?? []).map((h: {
        id: string;
        changeType: string;
        fieldName?: string | null;
        oldValue?: string | null;
        newValue?: string | null;
        changedAt: string;
        changedByUserId?: string;
      }) => ({
        id: h.id,
        changeType: h.changeType,
        fieldName: h.fieldName ?? undefined,
        oldValue: h.oldValue ?? null,
        newValue: h.newValue ?? null,
        reason: null,
        changedAt: h.changedAt,
        changedBy: h.changedByUserId ?? 'System',
      }));
    } catch (err) {
      console.warn('[CounsellingAzure] getHistory — non-blocking failure:', err);
      return [];
    }
  },

  /**
   * Fetch the current counselling record snapshot for a session.
   * Accepts either the Azure record's own UUID or the auth-service session UUID
   * (the backend tries both via PatientId fallback).
   * Returns null when no record exists yet — the caller must handle that gracefully.
   */
  async getRecord(id: string): Promise<{
    id: string;
    patientId: string;
    status: string;
    decisionType?: string | null;
    scheduledDate?: string | null;
    packageId?: string | null;
    packageDetails?: string | null;
    paymentType?: string | null;
    insuranceCompany?: string | null;
    isRescheduled: boolean;
    isPackageEdited: boolean;
    followUpDate?: string | null;
    followUpReason?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null> {
    try {
      const res = await getClient().get(`/counselling/${id}`);
      return res.data ?? null;
    } catch (err: unknown) {
      // 404 means no Azure record yet — that is normal for fresh sessions
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        return null;
      }
      console.warn('[CounsellingAzure] getRecord — non-blocking failure:', err);
      return null;
    }
  },
};
