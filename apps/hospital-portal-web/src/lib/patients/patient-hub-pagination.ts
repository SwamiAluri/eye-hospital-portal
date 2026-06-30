export function getPatientHubPageRange(
  currentPage: number,
  pageSize: number,
  totalCount: number,
): { start: number; end: number } {
  if (totalCount <= 0) {
    return { start: 0, end: 0 };
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  return { start, end };
}

/** Windowed page numbers with ellipsis for large result sets. */
export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible = 5,
): (number | 'ellipsis')[] {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= maxVisible + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (currentPage <= 3) {
    for (let page = 2; page <= Math.min(maxVisible, totalPages - 1); page += 1) {
      pages.push(page);
    }
    pages.push('ellipsis');
  } else if (currentPage >= totalPages - 2) {
    pages.push('ellipsis');
    for (
      let page = totalPages - maxVisible + 1;
      page < totalPages;
      page += 1
    ) {
      pages.push(page);
    }
  } else {
    pages.push('ellipsis');
    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
      pages.push(page);
    }
    pages.push('ellipsis');
  }

  pages.push(totalPages);
  return pages;
}
