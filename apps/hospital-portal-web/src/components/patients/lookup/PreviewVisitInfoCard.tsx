'use client';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { PatientActiveEngagement, PatientLookupRow, PatientSummary } from '@/types/patient-lookup';
import {
  isDirectoryVisitCheckedIn,
  resolveDirectoryVisitCheckInState,
} from '@/lib/patients/patient-hub-row-display';
import { inferVisitLaterality } from '@/lib/patients/preview-visit-helpers';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

const VISIT_TYPE_STYLES: Record<string, string> = {
  opd: counsellingSessionTokens.statusPillComplete,
  queue: 'bg-counselling-muted text-counselling-foreground',
  ip: counsellingSessionTokens.statusPillInfo,
  counselling: counsellingSessionTokens.statusPillComplete,
  insurance: counsellingSessionTokens.statusPillInfo,
  ccms: counsellingSessionTokens.statusPillInfo,
  billing: counsellingSessionTokens.statusPillRequired,
  camp: counsellingSessionTokens.statusPillComplete,
};

const fieldLabel =
  'text-[11px] font-medium uppercase tracking-wide text-counselling-muted-foreground';
const fieldValue = 'mt-0.5 text-sm font-medium leading-5 text-counselling-foreground';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={fieldLabel}>{label}</p>
      <div className={fieldValue}>{children}</div>
    </div>
  );
}

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
  const checkedIn = isDirectoryVisitCheckedIn(
    resolveDirectoryVisitCheckInState({ ...patient, summary }),
  );
  const scheduleText = formatSchedule(scheduledAt);

  const hasContent =
    scheduledAt || reason || providerName || station || visitChip || showSurgeryTag || laterality;

  if (!hasContent) return null;

  return (
    <div className="space-y-3" data-testid={patientLookupTestIds.previewVisitCard}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {visitChip && (
            <span
              className={cn(
                counsellingSessionTokens.statusPill,
                VISIT_TYPE_STYLES[visitChip.type.toLowerCase()] ??
                  'bg-counselling-muted text-counselling-foreground',
              )}
            >
              {visitChip.label}
            </span>
          )}
          {showSurgeryTag && (
            <span className={cn(counsellingSessionTokens.statusPill, counsellingSessionTokens.statusPillRequired)}>
              Surgery workup
            </span>
          )}
          {laterality && (
            <span className={cn(counsellingSessionTokens.statusPill, counsellingSessionTokens.statusPillInfo)}>
              {laterality}
            </span>
          )}
        </div>
        {scheduledAt && (
          <span className="shrink-0 text-xs font-medium text-counselling-muted-foreground">
            {checkedIn ? 'Checked in' : 'Scheduled'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
        {scheduleText && (
          <Field label="Time">
            <span className="font-semibold">{scheduleText}</span>
          </Field>
        )}

        {reason && (
          <Field label="Reason">
            <span className="font-normal leading-5">{reason}</span>
          </Field>
        )}

        {providerName && (
          <Field label="Provider">
            <span>{providerName}</span>
            {providerRole ? (
              <span className="mt-0.5 block text-xs font-normal text-counselling-muted-foreground">
                {providerRole}
              </span>
            ) : null}
          </Field>
        )}

        {station && <Field label="Location">{station}</Field>}
      </div>
    </div>
  );
}
