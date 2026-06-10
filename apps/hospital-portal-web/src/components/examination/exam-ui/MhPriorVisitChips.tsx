'use client';

import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface MhPriorVisitChipsProps {
  priorVisit: PriorVisitSnapshot | null;
}

export function MhPriorVisitChips({ priorVisit }: MhPriorVisitChipsProps) {
  if (!priorVisit) return null;
  const raw = priorVisit.raw as {
    allergies?: string[];
    conditions?: string[];
  } | undefined;
  const allergies = raw?.allergies ?? [];
  const conditions = raw?.conditions ?? [];
  if (!allergies.length && !conditions.length && !priorVisit.examinationDate) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-indigo-50/80 border border-indigo-100 rounded-lg">
      <span className="text-xs font-semibold text-indigo-900 w-full">
        Prior visit {priorVisit.examinationDate ? new Date(priorVisit.examinationDate).toLocaleDateString() : ''}
      </span>
      {conditions.slice(0, 4).map((c) => (
        <span
          key={c}
          className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700"
        >
          {c}
        </span>
      ))}
      {allergies.slice(0, 3).map((a) => (
        <span
          key={a}
          className="text-[10px] px-2 py-0.5 bg-red-50 border border-red-200 rounded text-red-800 font-medium"
        >
          ⚠ {a}
        </span>
      ))}
    </div>
  );
}
