'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  getPatientHubPageRange,
  getVisiblePageNumbers,
} from '@/lib/patients/patient-hub-pagination';
import { cn } from '@/lib/utils';

export interface PatientHubPaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PatientHubPagination({
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  className,
}: PatientHubPaginationProps) {
  if (totalCount <= 0) {
    return null;
  }

  const { start, end } = getPatientHubPageRange(currentPage, pageSize, totalCount);
  const pageNumbers = getVisiblePageNumbers(currentPage, totalPages);
  const showPageControls = totalPages > 1;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 text-xs text-counselling-muted-foreground sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      data-testid={patientLookupTestIds.pagination}
    >
      <p data-testid={patientLookupTestIds.paginationSummary}>
        Showing{' '}
        <span className="font-medium tabular-nums text-counselling-foreground">{start.toLocaleString()}</span>
        {' – '}
        <span className="font-medium tabular-nums text-counselling-foreground">{end.toLocaleString()}</span>
        {' of '}
        <span className="font-medium tabular-nums text-counselling-foreground">{totalCount.toLocaleString()}</span>
        {' patients'}
      </p>

      {showPageControls && (
        <nav
          className="flex items-center gap-0.5"
          aria-label="Patient list pagination"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted/50 hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={patientLookupTestIds.paginationPrev}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-1 text-counselling-muted-foreground/70"
                    aria-hidden
                  >
                    …
                  </span>
                );
              }

              const active = page === currentPage;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  className={cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
                    active
                      ? 'bg-counselling-primary text-white'
                      : 'text-counselling-muted-foreground hover:bg-counselling-muted/50 hover:text-counselling-foreground',
                  )}
                  data-testid={patientLookupTestIds.paginationPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted/50 hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={patientLookupTestIds.paginationNext}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
