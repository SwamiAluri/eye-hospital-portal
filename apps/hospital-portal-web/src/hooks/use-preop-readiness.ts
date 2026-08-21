'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ipManagementApi,
  type PacAssessmentDto,
  type PreOpClearanceDetailDto,
  type WardChecklistDto,
  type WardInvestigationChecklistDto,
} from '@/lib/api/ip-management.api';
import { usePreOpClearanceOptional } from '@/components/ip-management/preop/PreOpClearanceProvider';
import {
  mapPreOpReadinessFromApi,
  parsePreOpReadinessApiDto,
} from '@/lib/ip-management/preop-readiness-api';
import { computePreOpReadiness, type PreOpReadiness } from '@/lib/ip-management/preop-readiness';
import {
  computePreOpSafetySignals,
  type PreOpSafetySignals,
} from '@/lib/ip-management/preop-safety-signals';
import {
  computeMarkReadyGates,
  type MarkReadyGateResult,
} from '@/lib/ip-management/preop-mark-ready-gates';

export interface UsePreOpReadinessParams {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  financialState?: string;
  /** Scheduled operative eye (OD/OS) — feeds the safety strip laterality segment. */
  scheduledEye?: string | null;
  /** Bump to force a refresh (e.g. on step change or after a transition). */
  refreshKey?: unknown;
}

function safeClearanceDetail(raw: unknown): PreOpClearanceDetailDto | null {
  if (!raw || (raw as { error?: string }).error) return null;
  return raw as PreOpClearanceDetailDto;
}

/**
 * Single rollup load for the Ward Pre-Op Workspace (Phase 13). One hook fetches the
 * canonical sources once and derives per-step readiness for the sticky bar + step
 * rail — replacing the legacy 5-card phase strip that fired five parallel calls.
 *
 * Phase 8: readiness rollup is loaded from GET …/pre-op/readiness (server-authoritative).
 * Client computePreOpReadiness remains as an offline fallback. Safety signals and
 * Mark Ready gates still derive from the canonical source fetches below.
 */
export function usePreOpReadiness({
  journeyId,
  clinicalState,
  paymentMode,
  financialState,
  scheduledEye,
  refreshKey,
}: UsePreOpReadinessParams) {
  const sharedClearance = usePreOpClearanceOptional();
  const [readiness, setReadiness] = useState<PreOpReadiness | null>(null);
  const [safetySignals, setSafetySignals] = useState<PreOpSafetySignals | null>(null);
  const [markReadyGates, setMarkReadyGates] = useState<MarkReadyGateResult | null>(null);
  const [pac, setPac] = useState<PacAssessmentDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const clearancePromise = sharedClearance
      ? Promise.resolve(sharedClearance.detail)
      : ipManagementApi.getPreOpClearance(journeyId).catch(() => null);

    const [serverReadiness, detail, investigation, ward, pac] = await Promise.all([
      ipManagementApi.getPreOpReadiness(journeyId, paymentMode).catch(() => null),
      clearancePromise,
      ipManagementApi.getWardInvestigationChecklist(journeyId).catch(() => null),
      ipManagementApi.getWardChecklist(journeyId, paymentMode).catch(() => null),
      ipManagementApi.getPacAssessment(journeyId).catch(() => null),
    ]);
    const safeDetail = safeClearanceDetail(detail);
    const safeInvestigation = investigation as WardInvestigationChecklistDto | null;
    const safePac = pac as PacAssessmentDto | null;
    setPac(safePac);
    const parsedReadiness = parsePreOpReadinessApiDto(serverReadiness);
    if (serverReadiness && !parsedReadiness) {
      console.warn('[preop-readiness] invalid server rollup; using client fallback', serverReadiness);
    }
    setReadiness(
      parsedReadiness
        ? mapPreOpReadinessFromApi(parsedReadiness)
        : computePreOpReadiness({
            detail: safeDetail,
            investigation: safeInvestigation,
            ward: ward as WardChecklistDto | null,
            pac: safePac,
            financialState,
            clinicalState,
          }),
    );
    setSafetySignals(
      computePreOpSafetySignals({
        investigation: safeInvestigation,
        pac: safePac,
        detail: safeDetail,
        scheduledEye,
      }),
    );
    setMarkReadyGates(
      computeMarkReadyGates({
        investigation: safeInvestigation,
        pac: safePac,
        detail: safeDetail,
        scheduledEye,
      }),
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    journeyId,
    paymentMode,
    financialState,
    clinicalState,
    scheduledEye,
    sharedClearance?.detail,
  ]);

  useEffect(() => {
    if (sharedClearance?.loading) {
      setLoading(true);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey, sharedClearance?.loading]);

  useEffect(() => {
    if (!sharedClearance) return;
    return sharedClearance.registerOnChanged(() => {
      void load();
    });
  }, [sharedClearance, load]);

  return { readiness, safetySignals, markReadyGates, pac, loading, reload: load };
}
