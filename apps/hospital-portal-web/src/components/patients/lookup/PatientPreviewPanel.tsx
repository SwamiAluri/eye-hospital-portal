'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  LogIn,
  Phone,
  Printer,
  X,
  Maximize2,
} from 'lucide-react';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { IpAdmittedBadge } from '@/components/patients/lookup/IpAdmittedBadge';
import { PatientDataQualityBanner } from '@/components/patients/lookup/PatientDataQualityBanner';
import { PatientPreviewTabPanels } from '@/components/patients/lookup/PatientPreviewTabPanels';
import { PreviewEmergencyContactCard } from '@/components/patients/lookup/PreviewEmergencyContactCard';
import { PreviewVisitInfoCard } from '@/components/patients/lookup/PreviewVisitInfoCard';
import { PreviewVitalsGrid } from '@/components/patients/lookup/PreviewVitalsGrid';
import { PreviewModeToggle } from '@/components/patients/lookup/PreviewModeToggle';
import {
  usePatientRecentVisitsQuery,
  usePatientSummaryQuery,
  useRecordPatientRecentViewMutation,
} from '@/hooks/use-patient-lookup-queries';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import {
  calcPatientAge,
} from '@/lib/patients/patient-display-utils';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientHubPreviewMode } from '@/lib/patients/patient-hub-preview-mode';
import {
  patientEncounterUrl,
  patientProfileUrl,
} from '@/lib/patients/patient-routes';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

function AcuityBadge({ acuity }: { acuity: string }) {
  const styles =
    acuity === 'critical'
      ? 'bg-red-100 text-red-800'
      : acuity === 'high'
        ? 'bg-orange-100 text-orange-800'
        : acuity === 'medium'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-700';
  return (
    <span
      className={cn(
        'text-xs font-medium px-2 py-0.5 rounded-md capitalize',
        styles,
      )}
    >
      {acuity} acuity
    </span>
  );
}

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

  const age = calcPatientAge(display.dateOfBirth);
  const name = `${display.firstName} ${display.lastName}`;
  const engagements = summary?.activeEngagements ?? patient.activeEngagements;
  const ipAdmission = summary?.ipAdmission ?? patient.ipAdmission;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-white"
      data-testid={patientLookupTestIds.previewPanel}
    >
      <header className="shrink-0 border-b border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PatientAvatar
              size="md"
              firstName={display.firstName}
              lastName={display.lastName}
              photoUrl={display.photoThumbnailUrl}
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900">{name}</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {age != null ? `${age}y` : '—'} · {display.gender}
              </p>
              <p className="mt-0.5 font-mono text-xs text-gray-600">{display.mrn}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {display.phone && (
              <a
                href={`tel:${display.phone}`}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 hover:bg-emerald-100"
                aria-label="Call patient"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {showDockToggle && onPreviewModeToggle && (
              <PreviewModeToggle mode={previewMode} onToggle={onPreviewModeToggle} />
            )}
            <Link
              href={patientProfileUrl(patient.id)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 hover:text-emerald-800"
              aria-label="Expand to full profile"
              data-testid={patientLookupTestIds.previewExpand}
              onClick={() => onOpenProfile?.(patient.id)}
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
              aria-label="Close preview"
              data-testid={patientLookupTestIds.previewClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <IpAdmittedBadge admission={ipAdmission} />
          <AcuityBadge acuity={summary?.clinicalAcuity ?? patient.clinicalAcuity} />
          {engagements.map((e) => (
            <span
              key={`${e.type}-${e.label}`}
              className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-100"
            >
              {e.label}
            </span>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {summary?.dataQuality && (
          <PatientDataQualityBanner dataQuality={summary.dataQuality} />
        )}

        <PreviewVisitInfoCard patient={patient} summary={summary} />

        <PreviewEmergencyContactCard summary={summary} />

        <section className="rounded-xl border border-gray-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Vitals</p>
          <PreviewVitalsGrid vitals={summary?.latestVitals} />
        </section>

        <PatientPreviewTabPanels patientId={patient.id} summary={summary} />

        {visitsQuery.data && visitsQuery.data.length > 0 && (
          <div className="rounded-xl border border-gray-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Recent visits</p>
            <ul className="space-y-2">
              {visitsQuery.data.map((v) => (
                <li
                  key={v.id}
                  className="border-b border-gray-50 pb-2 text-sm last:border-0"
                >
                  <span className="font-mono text-xs text-gray-500">{v.tokenNumber}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="capitalize">{v.currentStation ?? v.status}</span>
                  {v.checkedInAt && (
                    <p className="text-xs text-gray-500">
                      {new Date(v.checkedInAt).toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summaryQuery.isLoading && (
          <div className="h-20 animate-pulse rounded-lg bg-gray-50" />
        )}
      </div>

      <footer className="shrink-0 border-t border-gray-100 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {summary?.assignedVisitId && (
            <Link
              href={patientEncounterUrl(patient.id, summary.assignedVisitId)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 sm:w-auto sm:order-1"
            >
              Continue encounter
            </Link>
          )}
          <Link
            href={patientProfileUrl(patient.id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:order-2"
            data-testid={patientLookupTestIds.previewOpenProfile}
            onClick={() => onOpenProfile?.(patient.id)}
          >
            Open full profile
            <ExternalLink className="h-4 w-4" />
          </Link>
          <Link
            href={`/dashboard/frontdesk/check-in?patientId=${patient.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 sm:order-3"
            data-testid={patientLookupTestIds.previewCheckIn}
          >
            <LogIn className="h-4 w-4" />
            Check in
          </Link>
          <Link
            href={`/dashboard/patients/${patient.id}/summary/print`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 sm:order-4"
          >
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </div>
      </footer>
    </div>
  );
}
