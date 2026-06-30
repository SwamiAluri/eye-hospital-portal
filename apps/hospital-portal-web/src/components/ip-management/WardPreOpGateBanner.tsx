'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ipManagementApi, ChecklistGateWarningDto } from '@/lib/api/ip-management.api';
import { nextClinicalTransition } from '@/lib/ip-management/ward-preop-progress';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface WardPreOpGateBannerProps {
  journeyId: string;
  clinicalState: string;
}

export function WardPreOpGateBanner({ journeyId, clinicalState }: WardPreOpGateBannerProps) {
  const [warnings, setWarnings] = useState<ChecklistGateWarningDto[]>([]);
  const [loading, setLoading] = useState(false);

  const targetState = nextClinicalTransition(clinicalState);

  const load = useCallback(async () => {
    if (!targetState) {
      setWarnings([]);
      return;
    }
    setLoading(true);
    try {
      const gates = await ipManagementApi.getTransitionGates(journeyId, targetState);
      setWarnings(gates?.warnings ?? []);
    } finally {
      setLoading(false);
    }
  }, [journeyId, targetState]);

  useEffect(() => {
    load();
  }, [load]);

  if (!targetState) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 px-1 py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking admission gates…
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <p
        className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2"
        data-testid={WARD_PREOP_TEST_IDS.gateBannerClear}
      >
        No checklist warnings for{' '}
        {clinicalState === 'Expected'
          ? 'admission'
          : clinicalState === 'Admitted'
            ? 'Mark Ready'
            : 'Send to OT'}
        .
      </p>
    );
  }

  const actionLabel =
    clinicalState === 'Expected'
      ? 'Admit Patient'
      : clinicalState === 'Admitted'
        ? 'Save & Mark Ready for Surgery'
        : 'Send to OT';

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5"
      data-testid={WARD_PREOP_TEST_IDS.gateBannerWarnings}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-900">
            Checklist warnings before {actionLabel}
          </p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Gates are warn-only — you can proceed after acknowledging.
          </p>
        </div>
      </div>
      <ul className="text-xs text-amber-900 space-y-0.5 pl-6 list-disc">
        {warnings.map(w => (
          <li key={w.code}>{w.message}</li>
        ))}
      </ul>
    </div>
  );
}
