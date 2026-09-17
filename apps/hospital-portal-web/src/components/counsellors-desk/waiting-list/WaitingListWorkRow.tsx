'use client';

import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  resolveWaitingListLifecycleAction,
  type WaitingListLifecycleActionKind,
} from '@/lib/counsellors-desk/waiting-list-lifecycle-action';
import {
  formatTime,
  getStatusBadge,
  isCoveragePaymentTypeValue,
} from '@/lib/counsellors-desk/session-utils';
import {
  WAITING_LIST_WORK_GRID,
  formatWaitingListDoctorDisplay,
} from '@/lib/counsellors-desk/waiting-list-layout';
import { resolveOwnershipRelation } from '@/lib/counsellors-desk/counselling-ownership';
import { isWaitingListEligibleForReassign } from '@/lib/counsellors-desk/counselling-auth';
import { resolveWaitingListAttention } from '@/lib/counsellors-desk/waiting-list-attention';
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
  currentUserId?: string | null;
  onRowClick: (patient: WaitingListPatient) => void;
  onDemographics: (patient: WaitingListPatient) => void;
  onPreAuth: (patientId: string) => void;
  /** Phase 3I — open Assign dialog for eligible unassigned rows. */
  onAssign?: (patient: WaitingListPatient) => void;
  /** Phase 3I Slice 6 — open Reassign dialog for owned Pending/Processed rows. */
  onReassign?: (patient: WaitingListPatient) => void;
  /** Lifecycle CTA click (Start Counseling/View/Continue/Re-evaluate/Start Repeat). */
  onLifecycleAction?: (
    patient: WaitingListPatient,
    kind: WaitingListLifecycleActionKind,
  ) => void;
  /** When false, hide Assign even if unassigned (no update permission). Default true when onAssign set. */
  canAssign?: boolean;
  /** When false, hide Reassign (no reassign permission). */
  canReassign?: boolean;
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
  currentUserId,
  onRowClick,
  onDemographics,
  onPreAuth,
  onAssign,
  onReassign,
  onLifecycleAction,
  canAssign = true,
  canReassign = false,
  className,
  'data-testid': testId = 'waiting-list-work-row',
}: WaitingListWorkRowProps) {
  const statusBadge = getStatusBadge(patient.status);
  const lifecycle = resolveWaitingListLifecycleAction({
    status: patient.status,
    counselorId: patient.counselorId,
    currentUserId,
    activeTab,
    patientType: patient.patientType,
    canAssign,
  });
  const isCoverage = isCoveragePaymentTypeValue(patient.patientType);
  /** PreAuthQueue tab: Pre-Auth remains the primary Action CTA (existing business rule). */
  const preAuthIsPrimary = lifecycle.kind === 'preauth';
  /** Coverage rows: Pre-Auth context lives in Payment / Coverage (not Action clutter). */
  const showPreAuthInPaymentColumn = isCoverage && !preAuthIsPrimary;
  const showAssign =
    Boolean(onAssign) && canAssign && lifecycle.kind === 'assign';
  const showReassign =
    Boolean(onReassign) &&
    canReassign &&
    isWaitingListEligibleForReassign({
      status: patient.status,
      counselorId: patient.counselorId,
    });
  const showLifecycleCta =
    !showAssign &&
    !preAuthIsPrimary &&
    Boolean(onLifecycleAction) &&
    (lifecycle.kind === 'open' ||
      lifecycle.kind === 'view' ||
      lifecycle.kind === 'continue' ||
      lifecycle.kind === 're-evaluate' ||
      lifecycle.kind === 'start-repeat');

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
  /** Payment column secondary — only coverage-auth labels (not Follow-up / Upgrade). */
  const paymentPreAuthHint =
    attention === 'Pre-Auth Required' || attention === 'CCMS Awaiting'
      ? attention
      : null;

  const paymentPrimary = patient.patientType?.trim() || '—';

  const ownership = resolveOwnershipRelation(patient.counselorId, currentUserId);
  const ownerPrimary =
    ownership === 'unassigned'
      ? 'Unassigned'
      : patient.counselorName?.trim() || 'Assigned';
  const ownerIsYou = ownership === 'current';

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

  const handleAssign = (e: MouseEvent) => {
    e.stopPropagation();
    onAssign?.(patient);
  };

  const handleReassign = (e: MouseEvent) => {
    e.stopPropagation();
    onReassign?.(patient);
  };

  const handleLifecycle = (e: MouseEvent) => {
    e.stopPropagation();
    onLifecycleAction?.(patient, lifecycle.kind);
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

  const visitSecondary = [doctor || null, displayTime(patient.time)]
    .filter((p) => Boolean(p && String(p).trim() && p !== '—'))
    .join(' · ');

  const procedurePrimary = patient.surgeryName?.trim() || '—';
  const eyeSecondary = patient.eye?.trim() || null;

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={testId}
      data-patient-id={patient.id}
      aria-pressed={isSelected}
      aria-label={`${patient.patientName}, ${statusBadge.label}, ${ownerPrimary}${ownerIsYou ? ' (you)' : ''}. Activate to open counselling session.`}
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
        <button
          type="button"
          data-testid="waiting-list-row-patient"
          className={cn(
            'group/patient flex min-w-0 items-center gap-2 rounded-md text-left',
            'min-[1600px]:items-start min-[1600px]:gap-2.5',
            '-mx-1 px-1 py-0.5',
            'hover:bg-counselling-muted/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
          )}
          onClick={handleDemographics}
          aria-label={`Open patient context for ${patient.patientName}`}
        >
          <PatientAvatar
            displayName={patient.patientName}
            size="sm"
            className="shrink-0 !ring-counselling-border/50 min-[1600px]:mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-semibold leading-5 text-counselling-foreground',
                'underline decoration-transparent underline-offset-2 transition-colors',
                'group-hover/patient:text-counselling-primary',
                'group-hover/patient:decoration-counselling-primary/60',
                'group-focus-visible/patient:text-counselling-primary',
                'group-focus-visible/patient:decoration-counselling-primary/60',
              )}
            >
              {patient.patientName}
            </p>
            <p className="mt-0 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground max-[1599px]:leading-[1.125rem]">
              {identityLine || '—'}
            </p>
          </div>
        </button>

        <div className="min-w-0" data-testid="waiting-list-row-visit">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {patient.type || '—'}
          </p>
          <p className="mt-0 truncate text-xs leading-4 text-counselling-muted-foreground">
            {visitSecondary || '—'}
          </p>
        </div>

        <div className="min-w-0" data-testid="waiting-list-row-procedure">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {procedurePrimary}
          </p>
          {eyeSecondary ? (
            <p className="mt-0 truncate text-xs leading-4 text-counselling-muted-foreground">
              {eyeSecondary}
            </p>
          ) : null}
        </div>

        <div
          className="min-w-0"
          data-testid="waiting-list-row-owner"
          aria-label={`Owned by ${ownerPrimary}${ownerIsYou ? ', you' : ''}`}
        >
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {ownerPrimary}
          </p>
          {ownerIsYou ? (
            <p className="mt-0 truncate text-xs leading-4 text-counselling-muted-foreground">
              You
            </p>
          ) : null}
        </div>

        <div
          className="min-w-0"
          data-testid="waiting-list-row-payment"
          aria-label={
            paymentPreAuthHint
              ? `${paymentPrimary}, ${paymentPreAuthHint}`
              : `Payment type ${paymentPrimary}`
          }
        >
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {paymentPrimary}
          </p>
          {showPreAuthInPaymentColumn && paymentPreAuthHint ? (
            <button
              type="button"
              className={cn(
                'mt-0 max-w-full truncate text-left text-xs leading-4',
                'text-counselling-muted-foreground underline decoration-counselling-border/60 underline-offset-2',
                'hover:text-counselling-foreground hover:decoration-counselling-foreground/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 rounded-sm',
              )}
              onClick={handlePreAuth}
              aria-label="Start or view pre-authorization"
              data-testid="waiting-list-row-preauth"
            >
              {paymentPreAuthHint}
            </button>
          ) : paymentPreAuthHint && preAuthIsPrimary ? (
            <p className="mt-0 truncate text-xs leading-4 text-counselling-muted-foreground">
              {paymentPreAuthHint}
            </p>
          ) : null}
        </div>

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

        <div
          className="flex min-w-0 items-center justify-end gap-1"
          data-testid="waiting-list-row-action"
        >
          {showAssign ? (
            <CounsellingButton
              type="button"
              size="sm"
              variant="outline"
              className="!min-h-8 h-8 px-2 text-xs font-medium border-counselling-primary/40 text-counselling-primary"
              onClick={handleAssign}
              aria-label={`Assign counselling session for ${patient.patientName}`}
              data-testid="waiting-list-row-assign"
            >
              Assign
            </CounsellingButton>
          ) : null}
          {showReassign ? (
            <CounsellingButton
              type="button"
              size="sm"
              variant="outline"
              className="!min-h-8 h-8 px-2 text-xs font-medium border-counselling-border text-counselling-foreground"
              onClick={handleReassign}
              aria-label={`Reassign counselling session for ${patient.patientName}`}
              data-testid="waiting-list-row-reassign"
            >
              Reassign
            </CounsellingButton>
          ) : null}
          {showLifecycleCta ? (
            <CounsellingButton
              type="button"
              size="sm"
              variant="outline"
              className="!min-h-8 h-8 px-2 text-xs font-medium border-counselling-border text-counselling-foreground"
              onClick={handleLifecycle}
              aria-label={`${lifecycle.label} counselling session for ${patient.patientName}`}
              data-testid={`waiting-list-row-lifecycle-${lifecycle.kind}`}
            >
              {lifecycle.label}
            </CounsellingButton>
          ) : null}
          {preAuthIsPrimary ? (
            <CounsellingButton
              type="button"
              size="sm"
              variant="outline"
              className="!min-h-8 h-8 px-2 text-xs font-medium border-counselling-primary/40 text-counselling-primary"
              onClick={handlePreAuth}
              aria-label="Start or view pre-authorization"
              data-testid="waiting-list-row-preauth"
            >
              Pre-Auth
            </CounsellingButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const WaitingListWorkRow = memo(WaitingListWorkRowComponent);
WaitingListWorkRow.displayName = 'WaitingListWorkRow';
