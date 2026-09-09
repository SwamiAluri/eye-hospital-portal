'use client';

import { memo } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { resolveOtReturnedAction } from '@/lib/counsellors-desk/ot-returned-action';
import { WAITING_LIST_OT_GRID } from '@/lib/counsellors-desk/waiting-list-layout';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { cn } from '@/lib/utils';

export type WaitingListOtReturnedRowProps = {
  row: PatientJourneyRowDto;
  index: number;
  onNavigate: (href: string) => void;
  className?: string;
  'data-testid'?: string;
};

function formatSurgeryDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function WaitingListOtReturnedRowComponent({
  row,
  index,
  onNavigate,
  className,
  'data-testid': testId = 'waiting-list-ot-returned-row',
}: WaitingListOtReturnedRowProps) {
  const reasonParts = (row.otReturnReason ?? '').split(' — ');
  const primaryReason = reasonParts[0]?.trim() || '—';
  const reasonNote = reasonParts.slice(1).join(' — ').trim();
  const surgeryDate = formatSurgeryDate(row.surgeryScheduledAt);
  const action = resolveOtReturnedAction({
    journeyId: row.id,
    counselingSessionId: row.counselingSessionId,
  });

  return (
    <div
      data-testid={testId}
      data-journey-id={row.id}
      className={cn(
        'min-h-14 bg-transparent px-1 py-2.5 transition-colors',
        'hover:bg-rose-50/30',
        className,
      )}
    >
      <div className={cn(WAITING_LIST_OT_GRID)}>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[12px] tabular-nums text-counselling-muted-foreground">
              #{index + 1}
            </span>
            <p className="min-w-0 truncate text-[12.5px] font-medium text-counselling-muted-foreground">
              {row.uhid?.trim() || '—'}
            </p>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold leading-5 text-counselling-foreground">
            {row.patientName?.trim() || '—'}
          </p>
          {row.eyeOperated ? (
            <p className="mt-0.5 text-[12px] text-counselling-muted-foreground">
              {row.eyeOperated}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-counselling-foreground">
            {row.procedureName?.trim() || '—'}
          </p>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-rose-800/90" title={primaryReason}>
            {primaryReason}
          </p>
          {reasonNote ? (
            <p
              className="mt-0.5 truncate text-[11px] text-counselling-muted-foreground"
              title={reasonNote}
            >
              {reasonNote}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-[12px] tabular-nums text-counselling-muted-foreground whitespace-nowrap">
            {surgeryDate}
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end">
          <CounsellingButton
            type="button"
            size="sm"
            className="!min-h-8 h-8 px-2.5 text-xs font-semibold"
            onClick={() => onNavigate(action.href)}
            aria-label={action.label}
            data-testid={`waiting-list-ot-action-${action.kind}`}
          >
            {action.kind === 'replan' ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            )}
            {action.label}
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}

export const WaitingListOtReturnedRow = memo(WaitingListOtReturnedRowComponent);
WaitingListOtReturnedRow.displayName = 'WaitingListOtReturnedRow';
