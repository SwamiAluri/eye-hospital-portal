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
        'mt-4 flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      data-testid={patientLookupTestIds.pagination}
    >
      <p data-testid={patientLookupTestIds.paginationSummary}>
        Showing{' '}
        <span className="font-medium text-gray-800">{start.toLocaleString()}</span>
        {' – '}
        <span className="font-medium text-gray-800">{end.toLocaleString()}</span>
        {' of '}
        <span className="font-medium text-gray-800">{totalCount.toLocaleString()}</span>
        {' patients'}
      </p>

      {showPageControls && (
        <nav
          className="flex flex-wrap items-center gap-1"
          aria-label="Patient list pagination"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={patientLookupTestIds.paginationPrev}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-1.5 text-gray-400"
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
                    'min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors',
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'border border-gray-200 text-gray-700 hover:border-emerald-200 hover:text-emerald-800',
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
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={patientLookupTestIds.paginationNext}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
