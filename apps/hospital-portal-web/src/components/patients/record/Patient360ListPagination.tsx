'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getPatientHubPageRange,
  getVisiblePageNumbers,
} from '@/lib/patients/patient-hub-pagination';

export function Patient360ListPagination({
  label,
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
}: {
  label: string;
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  if (totalCount <= pageSize || pageSize < 1) return null;

  const totalPages = Math.ceil(totalCount / pageSize);
  const { start, end } = getPatientHubPageRange(currentPage, pageSize, totalCount);
  const pageNumbers = getVisiblePageNumbers(currentPage, totalPages);

  return (
    <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {totalCount.toLocaleString()}
      </p>
      <nav className="flex flex-wrap items-center gap-1" aria-label={`${label} pagination`}>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        {pageNumbers.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              aria-current={page === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(page)}
              className={
                page === currentPage
                  ? 'h-8 min-w-8 rounded-lg bg-gray-900 px-2 text-sm text-white'
                  : 'h-8 min-w-8 rounded-lg border border-gray-200 px-2 text-sm hover:bg-gray-50'
              }
            >
              {page}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
