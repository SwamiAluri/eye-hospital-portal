'use client';

import { ArrowLeft, Calendar, Clock, Stethoscope } from 'lucide-react';
import type { RefObject } from 'react';
import type { CounsellingSession, WaitingListStatus } from '@/types/counsellors-desk';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { sessionTypeLabelForCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';

interface SessionPageHeaderProps {
  session: CounsellingSession;
  queueStatus: WaitingListStatus;
  isDirty: boolean;
  historyBtnRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onOpenHistory: () => void;
  doctorRecommendation?: string | null;
}

export function SessionPageHeader({
  session,
  queueStatus,
  isDirty,
  historyBtnRef,
  onBack,
  onOpenHistory,
  doctorRecommendation,
}: SessionPageHeaderProps) {
  const { sessionTypeOptions } = useCounsellorMasterOptions();
  const statusBadge = getStatusBadge(queueStatus);
  const sessionTypeLabel = session.sessionTypeCode
    ? sessionTypeLabelForCode(session.sessionTypeCode, sessionTypeOptions)
    : null;

  const initials = session.patientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="sticky top-0 z-30 mb-3 rounded-xl border border-counselling-border bg-counselling-card px-3 py-2.5 shadow-sm sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 shrink-0 gap-1 px-2 text-counselling-muted-foreground"
            aria-label="Back to waiting list"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </CounsellingButton>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-counselling-accent text-xs font-bold text-counselling-primary">
            {initials}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold text-counselling-foreground sm:text-base">
                {session.patientName}
              </h1>
              {isDirty ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  Unsaved
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-counselling-muted-foreground">
              <span>
                {session.age} yrs · {session.gender}
              </span>
              <span className="font-mono text-counselling-muted-foreground">{session.uhid}</span>
              {queueStatus !== 'RepeatCounselling' ? (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              ) : null}
              {sessionTypeLabel ? (
                <span className="rounded bg-counselling-muted px-1.5 py-0.5 text-[10px] text-counselling-foreground">
                  {sessionTypeLabel}
                </span>
              ) : null}
              {doctorRecommendation ? (
                <span
                  className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800"
                  title={`Doctor recommends: ${doctorRecommendation}`}
                >
                  <Stethoscope className="h-3 w-3 shrink-0" aria-hidden />
                  {doctorRecommendation}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 text-[11px] text-counselling-muted-foreground sm:flex">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(session.visitDate + 'T00:00:00').toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          <CounsellingButton
            type="button"
            ref={historyBtnRef}
            variant="outline"
            size="sm"
            onClick={onOpenHistory}
            className="h-8 gap-1.5 px-2.5 text-xs"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}
