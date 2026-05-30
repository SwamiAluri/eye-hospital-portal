'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import { parseCounsellorDraft } from '@/lib/api/ccms/parse-counsellor-draft';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { getClinicalSummary } from '@/lib/api/widgets.api';
import { useCcmsMasterData, useCcmsPatient, useCcmsSurgeons } from '@/hooks/use-ccms-case';
import {
  buildPreAuthPrefill,
  type PreAuthPrefillData,
} from '@/lib/ccms/build-preauth-prefill';

interface UsePreAuthPrefillOptions {
  case_: CoverageCase | null;
  policies: VisitPolicy[];
  enabled?: boolean;
}

export function usePreAuthPrefill({ case_, policies, enabled = true }: UsePreAuthPrefillOptions) {
  const { payers, tpas } = useCcmsMasterData(enabled);
  const { mrn: patientMrn } = useCcmsPatient(enabled ? case_?.patientId : null);
  const needSurgeonLookup = enabled && !!case_?.doctorId;
  const surgeonsQuery = useCcmsSurgeons(needSurgeonLookup);
  const surgeons = surgeonsQuery.data ?? [];

  const draft = useMemo(
    () => parseCounsellorDraft(case_?.counsellorDraftJson),
    [case_?.counsellorDraftJson],
  );
  const primaryPolicy = useMemo(
    () => policies.find(p => p.isPrimary) ?? policies[0] ?? null,
    [policies],
  );

  const baselinePrefill = useMemo(() => {
    if (!case_) return null;
    return buildPreAuthPrefill({
      case_,
      draft,
      primaryPolicy,
      payers,
      tpas,
    });
  }, [case_, draft, primaryPolicy, payers, tpas]);

  const [prefill, setPrefill] = useState<PreAuthPrefillData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !case_ || !baselinePrefill) {
      setPrefill(null);
      setLoading(false);
      return;
    }

    setPrefill(baselinePrefill);

    const sessionId = case_.sessionId;
    const needsOt = !!sessionId;
    const needsClinical = !!case_.patientId;
    const needsSurgeon = needSurgeonLookup && !baselinePrefill.treatingDoctorName;
    const surgeonsReady = !needSurgeonLookup || !surgeonsQuery.isLoading;

    if (!needsOt && !needsClinical && !needsSurgeon) {
      setLoading(false);
      return;
    }

    if (needsSurgeon && !surgeonsReady) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function enrich() {
      try {
        const [otRecord, clinical] = await Promise.all([
          needsOt && sessionId
            ? counsellorsDeskApi.getOtRecordForSession(sessionId, {
                uhid: patientMrn ?? undefined,
                name: case_!.patientName ?? draft?.insuredName ?? undefined,
              }).catch(() => null)
            : Promise.resolve(null),
          needsClinical && case_!.patientId
            ? getClinicalSummary(case_!.patientId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        let surgeonFromRegistry: { name: string; licenseNumber?: string } | null = null;
        if (needsSurgeon && case_!.doctorId) {
          const hit = surgeons.find(s => s.id === case_!.doctorId);
          if (hit) surgeonFromRegistry = { name: hit.name };
        }

        setPrefill(buildPreAuthPrefill({
          case_: case_!,
          draft,
          primaryPolicy,
          otRecord: otRecord ?? undefined,
          clinical: clinical ?? undefined,
          surgeonFromRegistry,
          payers,
          tpas,
        }));
      } catch (e: unknown) {
        if (!cancelled) {
          setError((e as { message?: string })?.message ?? 'Failed to load pre-fill data');
          setPrefill(baselinePrefill);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    enrich();
    return () => { cancelled = true; };
  }, [
    enabled,
    case_,
    baselinePrefill,
    draft,
    primaryPolicy,
    payers,
    tpas,
    patientMrn,
    needSurgeonLookup,
    surgeons,
    surgeonsQuery.isLoading,
  ]);

  return { prefill, loading, error };
}
