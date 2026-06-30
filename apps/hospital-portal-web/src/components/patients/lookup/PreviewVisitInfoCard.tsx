'use client';

import type { PatientActiveEngagement, PatientLookupRow, PatientSummary } from '@/types/patient-lookup';
import { inferVisitLaterality } from '@/lib/patients/preview-visit-helpers';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

const VISIT_TYPE_STYLES: Record<string, string> = {
  opd: 'bg-blue-50 text-blue-800 ring-blue-100',
  queue: 'bg-violet-50 text-violet-800 ring-violet-100',
  ip: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
  counselling: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  insurance: 'bg-cyan-50 text-cyan-800 ring-cyan-100',
  ccms: 'bg-sky-50 text-sky-900 ring-sky-100',
  billing: 'bg-amber-50 text-amber-800 ring-amber-100',
  camp: 'bg-teal-50 text-teal-800 ring-teal-100',
};

function formatSchedule(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function pickVisitTypeChip(engagements: PatientActiveEngagement[]): PatientActiveEngagement | null {
  const priority = ['ip', 'queue', 'opd', 'counselling', 'insurance', 'ccms', 'billing', 'camp'];
  for (const type of priority) {
    const match = engagements.find((e) => e.type.toLowerCase() === type);
    if (match) return match;
  }
  return engagements[0] ?? null;
}

function isSurgeryRelated(reason?: string | null, procedureName?: string | null): boolean {
  const text = `${reason ?? ''} ${procedureName ?? ''}`.toLowerCase();
  return /surgery|surgical|phaco|lasik|vitrectomy|procedure/.test(text);
}

export function PreviewVisitInfoCard({
  patient,
  summary,
}: {
  patient: PatientLookupRow;
  summary: PatientSummary | undefined;
}) {
  const scheduledAt = summary?.scheduledAt ?? patient.scheduledAt;
  const reason = summary?.reasonForVisit ?? patient.reasonForVisit;
  const providerName = summary?.assignedProviderName ?? patient.assignedProviderName;
  const providerRole = summary?.assignedProviderRole ?? patient.assignedProviderRole;
  const station = summary?.currentStation ?? patient.currentStation;
  const engagements = summary?.activeEngagements ?? patient.activeEngagements;
  const visitChip = pickVisitTypeChip(engagements);
  const procedureName = summary?.ipAdmission?.procedureName ?? patient.ipAdmission?.procedureName;
  const showSurgeryTag = isSurgeryRelated(reason, procedureName);
  const laterality = inferVisitLaterality(reason, procedureName);

  const hasContent =
    scheduledAt || reason || providerName || station || visitChip || showSurgeryTag || laterality;

  if (!hasContent) return null;

  return (
    <section
      className="rounded-xl border border-gray-200 p-3 space-y-2"
      data-testid={patientLookupTestIds.previewVisitCard}
    >
      <p className="text-xs font-semibold uppercase text-gray-500">Visit info</p>

      {scheduledAt && (
        <div>
          <p className="text-[11px] text-gray-500">Scheduled / checked in</p>
          <p className="text-sm font-medium text-gray-900">{formatSchedule(scheduledAt)}</p>
        </div>
      )}

      {providerName && (
        <div>
          <p className="text-[11px] text-gray-500">Assigned</p>
          <p className="text-sm text-gray-900">
            {providerName}
            {providerRole ? (
              <span className="text-gray-500"> · {providerRole}</span>
            ) : null}
          </p>
        </div>
      )}

      {station && (
        <div>
          <p className="text-[11px] text-gray-500">Station / location</p>
          <p className="text-sm text-gray-900 capitalize">{station}</p>
        </div>
      )}

      {reason && (
        <div>
          <p className="text-[11px] text-gray-500">Reason</p>
          <p className="text-sm text-gray-900">
            {reason}
            {laterality && (
              <span className="ml-2 inline-flex rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800 ring-1 ring-indigo-100">
                {laterality}
              </span>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {laterality && !reason && (
          <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800 ring-1 ring-indigo-100">
            {laterality}
          </span>
        )}
        {visitChip && (
          <span
            className={cn(
              'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1',
              VISIT_TYPE_STYLES[visitChip.type.toLowerCase()] ??
                'bg-gray-50 text-gray-700 ring-gray-100',
            )}
          >
            {visitChip.label}
          </span>
        )}
        {showSurgeryTag && (
          <span className="inline-flex rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800 ring-1 ring-orange-100">
            Surgery workup
          </span>
        )}
      </div>
    </section>
  );
}
