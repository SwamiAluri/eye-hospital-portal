'use client';

import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import { WAITING_LIST_WORK_GRID } from '@/lib/counsellors-desk/waiting-list-layout';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type WaitingListQueueWidgetProps = {
  /**
   * Optional accessible name for the queue region only — never rendered as a
   * visible section heading (selected tab already provides that context).
   */
  title?: string;
  /** Row count for callers/pagination; not rendered as a duplicate section counter. */
  count: number;
  /** @deprecated OT Returned uses the same counselling work grid; kept for call-site compat. */
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

function WorklistSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading</span>
      <div className="divide-y divide-counselling-border/40" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={cn('staff-worklist-row items-center px-1', WAITING_LIST_WORK_GRID)}
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
    </div>
  );
}

const COLUMN_CUES = [
  'Patient',
  'Visit',
  'Procedure / Eye',
  'Owner',
  'Payment / Coverage',
  'Status',
  'Action',
] as const;

/**
 * Queue Workspace — toolbar → column cues → rows → footer.
 * Does not render a selected-tab section title or duplicate count
 * (tabs + pagination already own that context).
 */
export function WaitingListQueueWidget({
  title,
  count: _count,
  mode: _mode = 'counselling',
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
  const showFooter = Boolean(footer) || Boolean(footerLabel) || isRefreshing;
  const regionLabel = title?.trim()
    ? `${title.trim()} patient queue`
    : 'Queue workspace';

  return (
    <section
      data-testid={testId}
      aria-label={regionLabel}
      className={cn(
        counsellingSessionTokens.sessionWidget,
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      {toolbar ? (
        <div
          className="shrink-0 border-b border-counselling-border/50 px-3 py-2.5 min-[1600px]:px-5 min-[1600px]:py-3"
          data-testid="waiting-list-queue-toolbar"
        >
          {toolbar}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-1 pt-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:pb-3 min-[1600px]:pt-3">
        {!isLoading && !isEmpty ? (
          <div
            className={cn(
              WAITING_LIST_WORK_GRID,
              'mb-0 shrink-0 border-b border-counselling-border/50 px-1 py-1 max-md:hidden min-[1600px]:py-2',
            )}
            role="row"
            data-testid="waiting-list-queue-column-cues"
          >
            {COLUMN_CUES.map((cue) => (
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

        <div
          data-testid="waiting-list-worklist-body"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
        >
          {isLoading ? (
            <WorklistSkeleton />
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              {emptyContent ?? (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-counselling-muted/60">
                    <Users className="h-5 w-5 text-counselling-muted-foreground opacity-60" />
                  </div>
                  <p
                    role="status"
                    className="text-sm font-medium text-counselling-foreground"
                  >
                    No patients found
                  </p>
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
