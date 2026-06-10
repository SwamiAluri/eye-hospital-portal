'use client';

import { useEffect, useState } from 'react';
import {
  ipManagementApi,
  CounsellorOutpatientChecklistDto,
  WardChecklistDto,
  WardInvestigationChecklistDto,
} from '@/lib/api/ip-management.api';

export interface ChecklistPhaseSummaryProps {
  journeyId: string;
  counselingSessionId?: string | null;
  paymentMode?: string;
}

interface PhaseChip {
  key: string;
  label: string;
  completed: number;
  total: number;
}

export function ChecklistPhaseSummary({
  journeyId,
  counselingSessionId,
  paymentMode,
}: ChecklistPhaseSummaryProps) {
  const [chips, setChips] = useState<PhaseChip[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [p0, p1, p2, clearance] = await Promise.all([
        counselingSessionId
          ? ipManagementApi.getCounsellorOutpatientChecklist(counselingSessionId).catch(() => null)
          : Promise.resolve(null as CounsellorOutpatientChecklistDto | null),
        ipManagementApi.getWardInvestigationChecklist(journeyId).catch(() => null),
        ipManagementApi.getWardChecklist(journeyId, paymentMode).catch(() => null),
        ipManagementApi.getPreOpClearance(journeyId).catch(() => null),
      ]);
      if (cancelled) return;

      const next: PhaseChip[] = [];

      if (p0) {
        next.push({
          key: 'p0',
          label: 'P0 Outpatient',
          completed: p0.completedItems,
          total: p0.totalItems,
        });
      }

      if (p1) {
        next.push({
          key: 'p1',
          label: 'P1 Investigation',
          completed: p1.completedItems,
          total: p1.totalItems,
        });
      }

      if (p2) {
        next.push({
          key: 'p2',
          label: 'P2 Ward (Form 2)',
          completed: p2.completedItems,
          total: p2.totalItems,
        });
      }

      if (clearance?.completions?.length) {
        const done = clearance.completions.filter(c => c.isCompleted || c.isBypassed).length;
        next.push({
          key: 'clearance',
          label: 'Pre-Op Clearance',
          completed: done,
          total: clearance.completions.length,
        });
      }

      setChips(next);
    }
    load();
    return () => { cancelled = true; };
  }, [journeyId, counselingSessionId, paymentMode]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {chips.map(chip => {
        const pct = chip.total > 0 ? Math.round((chip.completed / chip.total) * 100) : 0;
        const done = chip.total > 0 && chip.completed === chip.total;
        return (
          <span
            key={chip.key}
            className={[
              'inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-1 border',
              done ? 'bg-green-50 text-green-800 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200',
            ].join(' ')}
          >
            {chip.label}: {chip.completed}/{chip.total} ({pct}%)
          </span>
        );
      })}
    </div>
  );
}
