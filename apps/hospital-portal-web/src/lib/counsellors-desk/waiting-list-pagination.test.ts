import { describe, expect, it } from 'vitest';

import {
  WAITING_LIST_DEFAULT_PAGE_SIZE,
  getWaitingListPageRange,
  getWaitingListTotalPages,
  getWaitingListVisiblePages,
  sliceWaitingListPage,
} from './waiting-list-pagination';

describe('waiting-list-pagination', () => {
  it('defaults page size to 10', () => {
    expect(WAITING_LIST_DEFAULT_PAGE_SIZE).toBe(10);
  });

  it('computes total pages', () => {
    expect(getWaitingListTotalPages(0, 10)).toBe(1);
    expect(getWaitingListTotalPages(18, 10)).toBe(2);
    expect(getWaitingListTotalPages(10, 10)).toBe(1);
  });

  it('computes inclusive page ranges', () => {
    expect(getWaitingListPageRange(1, 10, 18)).toEqual({ start: 1, end: 10 });
    expect(getWaitingListPageRange(2, 10, 18)).toEqual({ start: 11, end: 18 });
    expect(getWaitingListPageRange(1, 10, 0)).toEqual({ start: 0, end: 0 });
  });

  it('slices items for the current page without mutating source', () => {
    const items = Array.from({ length: 18 }, (_, i) => i + 1);
    expect(sliceWaitingListPage(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(sliceWaitingListPage(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(items).toHaveLength(18);
  });

  it('returns compact visible page numbers', () => {
    expect(getWaitingListVisiblePages(1, 3)).toEqual([1, 2, 3]);
    expect(getWaitingListVisiblePages(1, 8)).toEqual([1, 2, 3, 4, 'ellipsis', 8]);
    expect(getWaitingListVisiblePages(5, 8)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 8]);
  });
});
