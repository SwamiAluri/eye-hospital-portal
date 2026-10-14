'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { IpAdmittedBadge } from '@/components/patients/lookup/IpAdmittedBadge';
import { PatientDataQualityBanner } from '@/components/patients/lookup/PatientDataQualityBanner';
import { PreviewEmergencyContactCard } from '@/components/patients/lookup/PreviewEmergencyContactCard';
import { PreviewVisitInfoCard } from '@/components/patients/lookup/PreviewVisitInfoCard';
import { PreviewModeToggle } from '@/components/patients/lookup/PreviewModeToggle';
import {
  usePatientRecentVisitsQuery,
  usePatientSummaryQuery,
  useRecordPatientRecentViewMutation,
} from '@/hooks/use-patient-lookup-queries';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import {
  canDirectoryOfferCheckIn,
  formatPatientHubIdentityLine,
  resolveDirectoryVisitCheckInState,
} from '@/lib/patients/patient-hub-row-display';
import { formatPatientDisplayName } from '@/lib/patients/patient-display-utils';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientHubPreviewMode } from '@/lib/patients/patient-hub-preview-mode';
import { buildFrontDeskCheckInHref } from '@/lib/patients/patient-handoff';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import type { PatientActiveEngagement, PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

function formatRecentVisitWhen(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function AcuityBadge({ acuity }: { acuity: string }) {
  const tone =
    acuity === 'critical'
      ? counsellingSessionTokens.statusPillDanger
      : acuity === 'high' || acuity === 'medium'
        ? counsellingSessionTokens.statusPillRequired
        : 'bg-counselling-muted text-counselling-foreground';
  return (
    <span className={cn(counsellingSessionTokens.statusPill, 'capitalize', tone)}>
      {acuity} acuity
    </span>
  );
}

/**
 * Avoid rendering the same visible label twice when two source fields
 * happen to produce identical pill text. Source data is unchanged.
 */
function uniqueContextEngagements(
  engagements: PatientActiveEngagement[],
  reservedLabels: string[],
): PatientActiveEngagement[] {
  const seen = new Set(reservedLabels.map((label) => label.trim().toLowerCase()).filter(Boolean));
  return engagements.filter((engagement) => {
    const key = engagement.label.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const previewSectionTitle =
  'text-xs font-semibold uppercase tracking-wide text-counselling-muted-foreground';
const previewSecondaryAction =
  'inline-flex text-xs font-medium text-counselling-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40';

export function PatientPreviewPanel({
  patient,
  branchId,
  open,
  onClose,
  onOpenProfile,
  showDockToggle = false,
  previewMode = 'docked',
  onPreviewModeToggle,
}: {
  patient: PatientLookupRow | null;
  branchId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenProfile?: (patientId: string) => void;
  showDockToggle?: boolean;
  previewMode?: PatientHubPreviewMode;
  onPreviewModeToggle?: () => void;
}) {
  const patientId = patient?.id ?? null;
  const summaryQuery = usePatientSummaryQuery(patientId, branchId, {
    skipPhiAudit: true,
    enabled: open,
  });
  const visitsQuery = usePatientRecentVisitsQuery(open ? patientId : null, branchId);
  const recordRecent = useRecordPatientRecentViewMutation();
  const auditedRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !patientId || !patient) return;
    if (auditedRef.current === patientId) return;
    auditedRef.current = patientId;

    patientLookupApi.logPhiAccess(patientId, 'preview').catch(() => {});
    recordRecent.mutate({
      patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      mrn: patient.mrn,
      photoThumbnailUrl: patient.photoThumbnailUrl,
    });
  }, [open, patientId, patient, recordRecent]);

  useEffect(() => {
    if (!open) auditedRef.current = null;
  }, [open]);

  const summary = summaryQuery.data;
  const display = summary ?? patient;
  if (!open || !patient || !display) return null;

  const name = formatPatientDisplayName(
    display,
    formatPatientDisplayName(patient),
  );
  const identityLine = formatPatientHubIdentityLine({
    mrn: display.mrn?.trim() ? display.mrn : patient.mrn,
    dateOfBirth: display.dateOfBirth || patient.dateOfBirth,
    gender: display.gender?.trim() ? display.gender : patient.gender,
  });
  const engagements = summary?.activeEngagements ?? patient.activeEngagements;
  const ipAdmission = summary?.ipAdmission ?? patient.ipAdmission;
  const acuity = summary?.clinicalAcuity ?? patient.clinicalAcuity;
  const ipLabel = ipAdmission?.isAdmitted
    ? ipAdmission.wardName
      ? `IP · ${ipAdmission.wardName}`
      : 'IP admitted'
    : '';
  const contextEngagements = uniqueContextEngagements(engagements, [
    `${acuity} acuity`,
    ipLabel,
  ]);

  const visits = visitsQuery.data ?? [];
  const showVisitEmpty = !visitsQuery.isLoading && !visitsQuery.isError && visits.length === 0;
  const showDataQuality =
    Boolean(summary?.dataQuality?.isIncomplete) || Boolean(summary?.dataQuality?.hasStaleVitals);
  const showCheckIn = canDirectoryOfferCheckIn(
    resolveDirectoryVisitCheckInState({ ...patient, summary }),
  );

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="counselling-session flex h-full min-h-0 flex-col bg-counselling-card outline-none"
      data-testid={patientLookupTestIds.previewPanel}
    >
      <header className="shrink-0 border-b border-counselling-border/60 px-4 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PatientAvatar
              size="md"
              firstName={display.firstName}
              lastName={display.lastName}
              photoUrl={display.photoThumbnailUrl}
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-counselling-foreground">{name}</h2>
              {identityLine && (
                <p className="mt-0.5 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground tabular-nums">
                  {identityLine}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {showDockToggle && onPreviewModeToggle && (
              <PreviewModeToggle
                mode={previewMode}
                onToggle={onPreviewModeToggle}
                className="border-counselling-border bg-counselling-card p-1.5 text-counselling-muted-foreground hover:bg-counselling-muted/40 hover:text-counselling-foreground"
              />
            )}
            <Link
              href={patientProfileUrl(patient.id)}
              className={cn(
                buttonVariants({ variant: 'primary', size: 'sm' }),
                'h-8 whitespace-nowrap px-2.5 text-xs',
              )}
              data-testid={patientLookupTestIds.previewOpenProfile}
              onClick={() => onOpenProfile?.(patient.id)}
            >
              Open Patient 360
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-counselling-border text-counselling-muted-foreground hover:bg-counselling-muted/40 hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
              aria-label="Close preview"
              data-testid={patientLookupTestIds.previewClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 divide-y divide-counselling-border/50 overflow-y-auto px-4"
        data-testid={patientLookupTestIds.previewBody}
      >
        <section className="py-2.5">
          <h3 className={previewSectionTitle}>Current context</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <IpAdmittedBadge
              admission={ipAdmission}
              className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-900 ring-0"
            />
            <AcuityBadge acuity={acuity} />
            {contextEngagements.map((e) => (
              <span
                key={`${e.type}-${e.label}`}
                className={cn(
                  counsellingSessionTokens.statusPill,
                  'max-w-full truncate bg-counselling-muted text-counselling-foreground',
                )}
              >
                {e.label}
              </span>
            ))}
          </div>
        </section>

        {summaryQuery.isError && (
          <p role="alert" className="py-3 text-sm text-red-800">
            Could not load preview details.
          </p>
        )}

        {summaryQuery.isLoading && !summary && (
          <div role="status" aria-label="Loading preview" className="space-y-2 py-3">
            <div className="h-10 animate-pulse rounded-lg bg-counselling-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-counselling-muted" />
          </div>
        )}

        {showDataQuality && summary?.dataQuality && (
          <section className="py-2.5">
            <h3 className={previewSectionTitle}>Data quality</h3>
            <PatientDataQualityBanner
              dataQuality={summary.dataQuality}
              summary="Missing/incomplete information"
              className="mt-1.5"
            />
          </section>
        )}

        <section className="py-2.5">
          <h3 className={previewSectionTitle}>Visit</h3>
          <div className="mt-1.5 rounded-lg border border-counselling-border/70 bg-counselling-muted/15 px-3 py-2.5">
            <PreviewVisitInfoCard patient={patient} summary={summary} />
            {showCheckIn && (
              <Link
                href={buildFrontDeskCheckInHref(patient.id)}
                className={cn(previewSecondaryAction, 'mt-2.5')}
                data-testid={patientLookupTestIds.previewCheckIn}
                aria-label="Check in"
              >
                Check in
              </Link>
            )}
          </div>
        </section>

        <section className="py-2.5">
          <h3 className={previewSectionTitle}>Emergency contact</h3>
          <div className="mt-1.5">
            <PreviewEmergencyContactCard summary={summary} />
          </div>
        </section>

        <section className="py-2.5">
          <h3 className={previewSectionTitle}>Recent visits</h3>
          {visitsQuery.isLoading && (
            <div
              className="mt-1.5 h-8 animate-pulse rounded-md bg-counselling-muted"
              role="status"
              aria-label="Loading recent visits"
            />
          )}
          {visitsQuery.isError && (
            <p role="alert" className="mt-1.5 text-sm text-red-800">
              Could not load recent visits.
            </p>
          )}
          {showVisitEmpty && (
            <p className="mt-1.5 text-sm text-counselling-muted-foreground">No recent visits.</p>
          )}
          {visits.length > 0 && (
            <ul className="mt-1.5">
              {visits.map((visit) => {
                const when = formatRecentVisitWhen(visit.checkedInAt);
                const place = [visit.currentStation, visit.status]
                  .map((part) => part?.trim())
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li
                    key={visit.id}
                    className="border-b border-counselling-border/40 py-2 first:pt-0 last:border-0 last:pb-0"
                  >
                    {when && (
                      <p className="text-sm font-semibold text-counselling-foreground">{when}</p>
                    )}
                    {visit.visitType && (
                      <p className="text-sm capitalize text-counselling-foreground">{visit.visitType}</p>
                    )}
                    {place && (
                      <p className="text-xs capitalize text-counselling-muted-foreground">{place}</p>
                    )}
                    {visit.tokenNumber && (
                      <p className="text-[11px] tabular-nums text-counselling-muted-foreground">
                        Token {visit.tokenNumber}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
