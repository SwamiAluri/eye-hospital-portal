'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  WAITING_LIST_PAGE_SIZE_OPTIONS,
  getWaitingListPageRange,
  getWaitingListTotalPages,
  getWaitingListVisiblePages,
  type WaitingListPageSize,
} from '@/lib/counsellors-desk/waiting-list-pagination';
import { cn } from '@/lib/utils';

export type WaitingListQueuePaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: WaitingListPageSize) => void;
  isRefreshing?: boolean;
  /** Noun in “Showing X–Y of Z {itemLabel}” — Waiting List default: patients */
  itemLabel?: string;
  className?: string;
  'data-testid'?: string;
};

/**
 * Quiet worklist footer: Showing 1–10 of N · ‹ 1 2 3 › · 10 / page
 * Client-side only; presentational.
 */
export function WaitingListQueuePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  isRefreshing = false,
  itemLabel = 'patients',
  className,
  'data-testid': testId = 'waiting-list-pagination',
}: WaitingListQueuePaginationProps) {
  if (totalCount <= 0) return null;

  const totalPages = getWaitingListTotalPages(totalCount, pageSize);
  const { start, end } = getWaitingListPageRange(page, pageSize, totalCount);
  const pages = getWaitingListVisiblePages(page, totalPages);

  return (
    <div
      data-testid={testId}
      className={cn(
        'flex flex-col gap-1 text-xs text-counselling-muted-foreground sm:flex-row sm:items-center sm:justify-between max-[1599px]:gap-1',
        className,
      )}
    >
      <p data-testid="waiting-list-pagination-summary">
        Showing{' '}
        <span className="font-medium tabular-nums text-counselling-foreground">{start}</span>
        –
        <span className="font-medium tabular-nums text-counselling-foreground">{end}</span>
        {' of '}
        <span className="font-medium tabular-nums text-counselling-foreground">{totalCount}</span>
        {` ${itemLabel}`}
        {isRefreshing ? (
          <span className="ml-2 inline-flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-counselling-border border-t-counselling-primary" />
            Refreshing
          </span>
        ) : null}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <nav
          className="flex items-center gap-0.5"
          aria-label="Patient queue pagination"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted/50 hover:text-counselling-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
            data-testid="waiting-list-pagination-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-1 text-counselling-muted-foreground/70" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums transition-colors',
                  p === page
                    ? 'bg-counselling-primary text-white'
                    : 'text-counselling-muted-foreground hover:bg-counselling-muted/50 hover:text-counselling-foreground',
                )}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                data-testid={`waiting-list-pagination-page-${p}`}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted/50 hover:text-counselling-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
            data-testid="waiting-list-pagination-next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>

        <label className="inline-flex items-center gap-1.5">
          <span className="sr-only">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as WaitingListPageSize)}
            className="h-8 rounded-md border border-counselling-border/70 bg-counselling-card px-2 text-xs font-medium text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            data-testid="waiting-list-pagination-page-size"
            aria-label="Rows per page"
          >
            {WAITING_LIST_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
