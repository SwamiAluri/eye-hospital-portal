'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ipManagementApi, ChecklistGateWarningDto } from '@/lib/api/ip-management.api';
import { nextClinicalTransition } from '@/lib/ip-management/ward-preop-progress';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface WardPreOpGateChipProps {
  journeyId: string;
  clinicalState: string;
}

/** Compact gate summary for workspace footer — full banner lives in transition modals only. */
export function WardPreOpGateChip({ journeyId, clinicalState }: WardPreOpGateChipProps) {
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
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking gates…
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <span
        className="inline-flex items-center text-[11px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5"
        data-testid={WARD_PREOP_TEST_IDS.gateChipClear}
      >
        No checklist warnings
      </span>
    );
  }

  const hardBlocks = warnings.filter(w => w.severity === 'block');
  const softWarnings = warnings.filter(w => w.severity !== 'block');
  const tooltip = warnings.map(w => w.message).join('\n');

  if (hardBlocks.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-800 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5"
        title={tooltip}
        data-testid={WARD_PREOP_TEST_IDS.gateChipHardBlocks}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {hardBlocks.length} hard stop{hardBlocks.length === 1 ? '' : 's'}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5"
      title={tooltip}
      data-testid={WARD_PREOP_TEST_IDS.gateChipWarnings}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {softWarnings.length} checklist warning{softWarnings.length === 1 ? '' : 's'}
    </span>
  );
}
