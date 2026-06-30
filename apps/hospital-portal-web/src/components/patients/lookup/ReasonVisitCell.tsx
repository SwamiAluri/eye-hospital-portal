'use client';

import {
  HUB_ENGAGEMENT_STYLES,
  pickPrimaryVisitEngagement,
} from '@/lib/patients/patient-hub-row-display';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

export function ReasonVisitCell({ row }: { row: PatientLookupRow }) {
  const reason = row.reasonForVisit;
  const visitChip = pickPrimaryVisitEngagement(row.activeEngagements ?? []);

  if (!reason && !visitChip) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div
      className="min-w-0 space-y-1"
      data-testid={patientLookupTestIds.reasonVisitCell(row.id)}
    >
      {reason && (
        <p className="truncate text-sm text-gray-800" title={reason}>
          {reason}
        </p>
      )}
      {visitChip && (
        <span
          className={cn(
            'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1',
            HUB_ENGAGEMENT_STYLES[visitChip.type.toLowerCase()] ??
              'bg-gray-50 text-gray-700 ring-gray-100',
          )}
        >
          {visitChip.label}
        </span>
      )}
    </div>
  );
}
