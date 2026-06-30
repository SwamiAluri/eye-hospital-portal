'use client';

import { formatCareProgramLabel } from '@/lib/patients/patient-display-utils';
import {
  HUB_ENGAGEMENT_STYLES,
  HUB_PROGRAM_STYLES,
} from '@/lib/patients/patient-hub-row-display';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 3;

export function HighlightsPills({ row }: { row: PatientLookupRow }) {
  const programs = (row.careProgramCodes ?? []).map((code) => ({
    key: `program-${code}`,
    label: formatCareProgramLabel(code),
    style:
      HUB_PROGRAM_STYLES[code.toUpperCase()] ??
      'bg-slate-100 text-slate-800 ring-slate-100',
  }));

  const engagements = (row.activeEngagements ?? []).map((e) => ({
    key: `eng-${e.type}-${e.label}`,
    label: e.label,
    style:
      HUB_ENGAGEMENT_STYLES[e.type.toLowerCase()] ??
      'bg-gray-50 text-gray-700 ring-gray-100',
  }));

  const pills = [...programs, ...engagements];

  if (pills.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const visible = pills.slice(0, MAX_VISIBLE);
  const overflow = pills.length - visible.length;

  return (
    <div
      className="flex flex-wrap gap-1"
      data-testid={patientLookupTestIds.highlightsCell(row.id)}
    >
      {visible.map((pill) => (
        <span
          key={pill.key}
          className={cn(
            'inline-flex max-w-[120px] truncate rounded-md px-2 py-0.5 text-[11px] font-medium ring-1',
            pill.style,
          )}
        >
          {pill.label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          +{overflow}
        </span>
      )}
    </div>
  );
}
