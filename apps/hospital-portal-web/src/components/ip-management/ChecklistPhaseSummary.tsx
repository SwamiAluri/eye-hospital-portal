'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import {
  buildWardPreOpPhaseProgress,
  phaseIsComplete,
  phaseProgressPercent,
  phaseToChecklistSection,
  type WardPreOpPhaseKey,
  type WardPreOpPhaseProgress,
} from '@/lib/ip-management/ward-preop-progress';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ChecklistPhaseSummaryProps {
  journeyId: string;
  counselingSessionId?: string | null;
  paymentMode?: string;
  /** When set, chips navigate to the matching § stepper section */
  onPhaseNavigate?: (section: ReturnType<typeof phaseToChecklistSection>) => void;
}

export function ChecklistPhaseSummary({
  journeyId,
  counselingSessionId,
  paymentMode,
  onPhaseNavigate,
}: ChecklistPhaseSummaryProps) {
  const [phases, setPhases] = useState<WardPreOpPhaseProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p0, p1, clearance, p3, pac] = await Promise.all([
      counselingSessionId
        ? ipManagementApi.getCounsellorOutpatientChecklist(counselingSessionId).catch(() => null)
        : Promise.resolve(null),
      ipManagementApi.getWardInvestigationChecklist(journeyId).catch(() => null),
      ipManagementApi.getPreOpClearance(journeyId).catch(() => null),
      ipManagementApi.getWardChecklist(journeyId, paymentMode).catch(() => null),
      ipManagementApi.getPacAssessment(journeyId).catch(() => null),
    ]);

    setPhases(
      buildWardPreOpPhaseProgress({
        p0,
        p1,
        clearance,
        p3,
        pac,
        includeP0: !!counselingSessionId,
      }),
    );
    setLoading(false);
  }, [journeyId, counselingSessionId, paymentMode]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading phase progress…
      </div>
    );
  }

  if (phases.length === 0) return null;

  return (
    <div
      className="space-y-2"
      data-testid={WARD_PREOP_TEST_IDS.phaseProgressStrip}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Pre-op phase progress
        </p>
        <button
          type="button"
          onClick={load}
          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {phases.map(phase => (
          <PhaseChip
            key={phase.key}
            phase={phase}
            onClick={
              onPhaseNavigate
                ? () => onPhaseNavigate(phaseToChecklistSection(phase.key as WardPreOpPhaseKey))
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function PhaseChip({
  phase,
  onClick,
}: {
  phase: WardPreOpPhaseProgress;
  onClick?: () => void;
}) {
  const pct = phaseProgressPercent(phase.completed, phase.total);
  const done = phaseIsComplete(phase.completed, phase.total);
  const started = phase.completed > 0;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={phase.detail}
      data-testid={WARD_PREOP_TEST_IDS.phaseChip(phase.key)}
      className={[
        'min-w-[108px] rounded-lg border px-2.5 py-1.5 text-left transition-colors',
        onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-200' : '',
        done
          ? 'bg-green-50 border-green-200'
          : started
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold text-gray-700">{phase.shortLabel}</span>
        <span className="text-[10px] font-medium text-gray-600">
          {phase.total > 0 ? `${phase.completed}/${phase.total}` : '—'}
        </span>
      </div>
      <p className="text-[10px] text-gray-600 truncate mt-0.5">{phase.label.replace(/^P\d+\s/, '')}</p>
      <div className="mt-1 h-1 rounded-full bg-white/80 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-indigo-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Wrapper>
  );
}
