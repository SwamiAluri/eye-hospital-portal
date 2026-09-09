/**
 * Client-side waiting-list pagination helpers (no API / query changes).
 */

export const WAITING_LIST_DEFAULT_PAGE_SIZE = 10;

export const WAITING_LIST_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type WaitingListPageSize = (typeof WAITING_LIST_PAGE_SIZE_OPTIONS)[number];

export function getWaitingListTotalPages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function getWaitingListPageRange(
  page: number,
  pageSize: number,
  totalCount: number,
): { start: number; end: number } {
  if (totalCount <= 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  return { start, end };
}

export function sliceWaitingListPage<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): T[] {
  if (pageSize <= 0) return [...items];
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Compact page number list for quiet worklist footer (‹ 1 2 3 ›). */
export function getWaitingListVisiblePages(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];

  if (currentPage <= 3) {
    pages.push(2, 3, 4, 'ellipsis', totalPages);
    return pages;
  }

  if (currentPage >= totalPages - 2) {
    pages.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    return pages;
  }

  pages.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
  return pages;
}
