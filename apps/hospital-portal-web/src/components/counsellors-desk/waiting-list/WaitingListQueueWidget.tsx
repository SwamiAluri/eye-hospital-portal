'use client';

import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import {
  WAITING_LIST_OT_GRID,
  WAITING_LIST_WORK_GRID,
} from '@/lib/counsellors-desk/waiting-list-layout';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type WaitingListQueueWidgetProps = {
  title?: string;
  count: number;
  mode?: 'counselling' | 'ot-returned';
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyContent?: ReactNode;
  isRefreshing?: boolean;
  /** Flat toolbar rendered inside the single Queue Workspace surface. */
  toolbar?: ReactNode;
  /** Quiet footer (pagination / range). Rendered outside the scroll body. */
  footer?: ReactNode;
  /** @deprecated Prefer `footer` — kept for simple text-only footers in tests */
  footerLabel?: string;
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
};

function WorklistSkeleton({ mode }: { mode: 'counselling' | 'ot-returned' }) {
  return (
    <div className="divide-y divide-counselling-border/40" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'staff-worklist-row items-center px-1',
            mode === 'ot-returned' ? WAITING_LIST_OT_GRID : WAITING_LIST_WORK_GRID,
          )}
        >
          <div className="h-3 max-w-[80%] animate-pulse rounded-full bg-counselling-muted" />
          <div className="hidden h-3 max-w-[70%] animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-3 max-w-[70%] animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-3 max-w-[55%] animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-3 max-w-[55%] animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-3 w-14 animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-7 w-16 justify-self-end animate-pulse rounded-md bg-counselling-muted sm:block" />
        </div>
      ))}
    </div>
  );
}

const COUNSELLING_CUES = [
  'Patient',
  'Visit',
  'Procedure / Eye',
  'Owner',
  'Payment / Coverage',
  'Status',
  'Action',
] as const;
const OT_CUES = ['UHID / Patient', 'Procedure', 'Return Reason', 'Surgery Date', 'Action'] as const;

/**
 * Queue Workspace — the single Waiting List functional surface.
 * Height model: shrink-0 chrome (toolbar / title / cues / pagination) +
 * flex-1 min-h-0 scrollable worklist body. Page does not scroll rows.
 */
export function WaitingListQueueWidget({
  title = 'Patient Queue',
  count,
  mode = 'counselling',
  isLoading = false,
  isEmpty = false,
  emptyContent,
  isRefreshing = false,
  toolbar,
  footer,
  footerLabel,
  children,
  className,
  'data-testid': testId = 'waiting-list-queue',
}: WaitingListQueueWidgetProps) {
  const cues = mode === 'ot-returned' ? OT_CUES : COUNSELLING_CUES;
  const gridClass = mode === 'ot-returned' ? WAITING_LIST_OT_GRID : WAITING_LIST_WORK_GRID;
  const showFooter = Boolean(footer) || Boolean(footerLabel) || isRefreshing;

  return (
    <section
      data-testid={testId}
      aria-label="Queue workspace"
      className={cn(
        counsellingSessionTokens.sessionWidget,
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      {toolbar ? (
        <div
          className="shrink-0 border-b border-counselling-border/50 px-2.5 py-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:py-3"
          data-testid="waiting-list-queue-toolbar"
        >
          {toolbar}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-1 pt-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:pb-3 min-[1600px]:pt-3">
        <div className="flex shrink-0 items-center justify-between gap-2 pb-0.5 min-[1600px]:pb-2">
          <h2 className={cn(counsellingSessionTokens.sessionWidgetTitle, 'max-[1599px]:text-sm max-[1599px]:leading-5')}>{title}</h2>
          <span className="text-xs font-medium text-counselling-muted-foreground">
            <span className="tabular-nums text-counselling-foreground">{count}</span>
            {' '}
            patients
          </span>
        </div>

        {!isLoading && !isEmpty ? (
          <div
            className={cn(
              gridClass,
              'mb-0 shrink-0 border-b border-counselling-border/50 px-1 py-1 max-md:hidden min-[1600px]:py-2',
            )}
            role="row"
            data-testid="waiting-list-queue-column-cues"
          >
            {cues.map((cue) => (
              <p
                key={cue}
                role="columnheader"
                className={cn(
                  'text-sm font-semibold leading-5 tracking-normal text-counselling-foreground',
                  cue === 'Action' && 'text-right',
                )}
              >
                {cue}
              </p>
            ))}
          </div>
        ) : null}

        {/* Flexible work area — owns vertical scroll; pagination stays outside */}
        <div
          data-testid="waiting-list-worklist-body"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
        >
          {isLoading ? (
            <WorklistSkeleton mode={mode} />
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              {emptyContent ?? (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-counselling-muted/60">
                    <Users className="h-5 w-5 text-counselling-muted-foreground opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-counselling-foreground">No patients in queue</p>
                </>
              )}
            </div>
          ) : (
            <div className="min-w-0 divide-y divide-counselling-border/40">{children}</div>
          )}
        </div>

        {showFooter ? (
          <div
            data-testid="waiting-list-queue-footer"
            className="mt-1 shrink-0 border-t border-counselling-border/50 pt-1 min-[1600px]:mt-2 min-[1600px]:pt-2"
          >
            {footer ?? (
              <div className="flex items-center justify-between px-1 text-xs text-counselling-muted-foreground">
                <span>{footerLabel}</span>
                {isRefreshing ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-counselling-border border-t-counselling-primary" />
                    Refreshing
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
