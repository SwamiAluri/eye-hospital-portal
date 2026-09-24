import { describe, expect, it } from 'vitest';
import {
  SESSIONS_PAGE_QUERY_PARAM,
  SESSIONS_PAGE_SIZE,
  clampSessionsPage,
  parseSessionsPageParam,
  setSessionsPageInSearchParams,
} from './sessions-pagination';
import { toggleReassignmentRequiredInSearchParams } from './reassignment-required-filter';

describe('sessions-pagination (PD-S13-PAG-01/02)', () => {
  it('uses accepted page size of 20', () => {
    expect(SESSIONS_PAGE_SIZE).toBe(20);
  });

  it('parses missing or invalid page as 1', () => {
    expect(parseSessionsPageParam(null)).toBe(1);
    expect(parseSessionsPageParam(undefined)).toBe(1);
    expect(parseSessionsPageParam('')).toBe(1);
    expect(parseSessionsPageParam('0')).toBe(1);
    expect(parseSessionsPageParam('-3')).toBe(1);
    expect(parseSessionsPageParam('abc')).toBe(1);
    expect(parseSessionsPageParam('2.9')).toBe(2);
  });

  it('parses positive integer page values', () => {
    expect(parseSessionsPageParam('1')).toBe(1);
    expect(parseSessionsPageParam('2')).toBe(2);
    expect(parseSessionsPageParam('12')).toBe(12);
  });

  it('sets page in URLSearchParams and preserves RR', () => {
    const current = new URLSearchParams('reassignmentRequired=true&page=1');
    const next = setSessionsPageInSearchParams(current, 2);
    expect(next.get('reassignmentRequired')).toBe('true');
    expect(next.get(SESSIONS_PAGE_QUERY_PARAM)).toBe('2');
  });

  it('omits page query when resetting to page 1', () => {
    const current = new URLSearchParams('reassignmentRequired=true&page=3');
    const next = setSessionsPageInSearchParams(current, 1);
    expect(next.get('reassignmentRequired')).toBe('true');
    expect(next.get(SESSIONS_PAGE_QUERY_PARAM)).toBeNull();
  });

  it('resets page to 1 when toggling RR (filter → page reset)', () => {
    const withPage = new URLSearchParams('page=3');
    const rrOn = toggleReassignmentRequiredInSearchParams(withPage, true);
    const rrOnReset = setSessionsPageInSearchParams(rrOn, 1);
    expect(rrOnReset.get('reassignmentRequired')).toBe('true');
    expect(rrOnReset.get(SESSIONS_PAGE_QUERY_PARAM)).toBeNull();

    const rrPage = new URLSearchParams('reassignmentRequired=true&page=3');
    const rrOff = toggleReassignmentRequiredInSearchParams(rrPage, false);
    const rrOffReset = setSessionsPageInSearchParams(rrOff, 1);
    expect(rrOffReset.get('reassignmentRequired')).toBeNull();
    expect(rrOffReset.get(SESSIONS_PAGE_QUERY_PARAM)).toBeNull();
  });

  it('clamps page when TotalPages shrinks after refresh', () => {
    expect(clampSessionsPage(3, 2)).toBe(2);
    expect(clampSessionsPage(2, 2)).toBe(2);
    expect(clampSessionsPage(1, 5)).toBe(1);
    expect(clampSessionsPage(0, 5)).toBe(1);
    expect(clampSessionsPage(4, 0)).toBe(1);
  });
});
