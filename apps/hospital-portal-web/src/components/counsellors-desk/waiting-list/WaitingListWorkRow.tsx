'use client';

import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronRight, User } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { resolveWaitingListAttention } from '@/lib/counsellors-desk/waiting-list-attention';
import { resolveWaitingListPrimaryAction } from '@/lib/counsellors-desk/waiting-list-primary-action';
import {
  formatTime,
  getStatusBadge,
  isCoveragePaymentTypeValue,
} from '@/lib/counsellors-desk/session-utils';
import {
  WAITING_LIST_WORK_GRID,
  formatWaitingListDoctorDisplay,
} from '@/lib/counsellors-desk/waiting-list-layout';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { formatPatientSex } from '@/lib/patients/patient-display-utils';
import type { WaitingListPatient } from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';

export type WaitingListWorkRowProps = {
  patient: WaitingListPatient;
  isSelected: boolean;
  activeTab: string;
  ccmsState?: string;
  hasCcmsCase: boolean;
  ccmsDecision?: string | null;
  onRowClick: (patient: WaitingListPatient) => void;
  onDemographics: (patient: WaitingListPatient) => void;
  onPreAuth: (patientId: string) => void;
  className?: string;
  'data-testid'?: string;
};

function displayTime(raw: string): string {
  if (!raw?.trim()) return '—';
  if (/^\d{1,2}:\d{2}/.test(raw.trim())) {
    return formatTime(raw.trim()) || raw;
  }
  return raw;
}

function WaitingListWorkRowComponent({
  patient,
  isSelected,
  activeTab,
  ccmsState,
  hasCcmsCase,
  ccmsDecision,
  onRowClick,
  onDemographics,
  onPreAuth,
  className,
  'data-testid': testId = 'waiting-list-work-row',
}: WaitingListWorkRowProps) {
  const statusBadge = getStatusBadge(patient.status);
  const attention = resolveWaitingListAttention({
    status: patient.status,
    patientType: patient.patientType,
    ccmsState,
    hasCcmsCase,
    ccmsDecision,
    followUpDate: patient.followUpDate,
    followUpReason: patient.followUpReason,
    previousPackage: patient.previousPackage,
    newPackage: patient.newPackage,
    upgradeDiff: patient.upgradeDiff,
  });
  const primary = resolveWaitingListPrimaryAction({
    status: patient.status,
    activeTab,
    patientType: patient.patientType,
  });
  const isCoverage = isCoveragePaymentTypeValue(patient.patientType);
  /** PreAuthQueue: Pre-Auth is the contextual action (not a View/Open nav button). */
  const showPreAuthContextual =
    primary.kind === 'preauth' || (isCoverage && activeTab !== 'PreAuthQueue');
  const preAuthIsPrimary = primary.kind === 'preauth';

  const activateRow = () => onRowClick(patient);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateRow();
    }
  };

  const handlePreAuth = (e: MouseEvent) => {
    e.stopPropagation();
    onPreAuth(patient.id);
  };

  const handleDemographics = (e: MouseEvent) => {
    e.stopPropagation();
    onDemographics(patient);
  };

  const doctor = formatWaitingListDoctorDisplay(patient.doctor);
  const sex = formatPatientSex(patient.gender);
  const identityLine = [
    patient.uhid,
    patient.age != null && patient.age > 0 ? `${patient.age} yrs` : null,
    sex || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const metaParts = [
    patient.type,
    patient.patientType,
    doctor || null,
    displayTime(patient.time),
    patient.slNo != null ? `#${patient.slNo}` : null,
  ].filter((p) => Boolean(p && String(p).trim()));

  const procedureLabel = [patient.surgeryName?.trim() || '—', patient.eye?.trim() || null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={testId}
      data-patient-id={patient.id}
      aria-pressed={isSelected}
      aria-label={`${patient.patientName}, ${statusBadge.label}${attention ? `, ${attention}` : ''}. Activate to open counselling session.`}
      onClick={activateRow}
      onKeyDown={onKeyDown}
      className={cn(
        'group staff-worklist-row cursor-pointer bg-transparent px-1 transition-colors',
        'hover:bg-counselling-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40',
        isSelected && 'bg-counselling-accent/35',
        className,
      )}
    >
      <div className={cn(WAITING_LIST_WORK_GRID)}>
        {/* Patient — same fields; workstation collapses secondary meta into identity line */}
        <div className="flex min-w-0 items-center gap-2 min-[1600px]:items-start min-[1600px]:gap-2.5">
          <PatientAvatar
            displayName={patient.patientName}
            size="sm"
            className="shrink-0 !ring-counselling-border/50 min-[1600px]:mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5 text-counselling-foreground">
              {patient.patientName}
            </p>
            <p className="mt-0 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground max-[1599px]:leading-[1.125rem]">
              <span>{identityLine || '—'}</span>
              {metaParts.length > 0 ? (
                <span className="min-[1600px]:hidden">{` · ${metaParts.join(' · ')}`}</span>
              ) : null}
            </p>
            {/* Desktop keeps a dedicated meta line (Large Desktop SoT) */}
            <p className="mt-0.5 hidden truncate text-xs leading-4 text-counselling-muted-foreground min-[1600px]:block">
              {metaParts.join(' · ') || '—'}
            </p>
          </div>
        </div>

        {/* Procedure · Eye */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {procedureLabel}
          </p>
        </div>

        {/* Status */}
        <div className="min-w-0">
          <span
            className={cn(
              counsellingSessionTokens.statusPill,
              'max-w-full truncate',
              statusBadge.cls,
            )}
          >
            {statusBadge.label}
          </span>
        </div>

        {/* Attention */}
        <div className="min-w-0">
          {attention ? (
            <p className="truncate text-xs font-medium leading-4 text-amber-800" title={attention}>
              {attention}
            </p>
          ) : (
            <span className="text-xs text-counselling-muted-foreground/60">—</span>
          )}
        </div>

        {/* Utilities only — NO View/Open/Start/Continue navigation button */}
        <div className="flex min-w-0 items-center justify-end gap-0.5">
          {showPreAuthContextual ? (
            <CounsellingButton
              type="button"
              size="sm"
              variant={preAuthIsPrimary ? 'outline' : 'ghost'}
              className={cn(
                '!min-h-8 h-8 px-2 text-xs font-medium',
                preAuthIsPrimary
                  ? 'border-counselling-primary/40 text-counselling-primary'
                  : 'text-counselling-muted-foreground hover:text-counselling-foreground',
              )}
              onClick={handlePreAuth}
              aria-label="Start or view pre-authorization"
              data-testid="waiting-list-row-preauth"
            >
              Pre-Auth
            </CounsellingButton>
          ) : null}
          <CounsellingButton
            type="button"
            size="sm"
            variant="ghost"
            className="!min-h-8 h-8 w-8 shrink-0 px-0 text-counselling-muted-foreground/70 hover:text-counselling-muted-foreground"
            onClick={handleDemographics}
            aria-label="Patient details"
          >
            <User className="h-3.5 w-3.5" />
          </CounsellingButton>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-counselling-muted-foreground/50 transition-colors group-hover:text-counselling-muted-foreground"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export const WaitingListWorkRow = memo(WaitingListWorkRowComponent);
WaitingListWorkRow.displayName = 'WaitingListWorkRow';
