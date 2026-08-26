import { describe, expect, it } from 'vitest';
import {
  censusCountForTab,
  censusTabCountsAreUsable,
  coerceCensusTabCounts,
  EMPTY_CENSUS_TAB_COUNTS,
  resolveCensusTabCount,
} from '@/hooks/use-census-tab-counts-query';

describe('censusCountForTab', () => {
  it('reads server tab counts by census key', () => {
    const counts = { ...EMPTY_CENSUS_TAB_COUNTS, all: 12, readyForOt: 3, cancelled: 1 };
    expect(censusCountForTab(counts, 'All')).toBe(12);
    expect(censusCountForTab(counts, 'ReadyForOt')).toBe(3);
    expect(censusCountForTab(counts, 'Cancelled')).toBe(1);
    expect(censusCountForTab(null, 'All')).toBeUndefined();
  });
});

describe('coerceCensusTabCounts', () => {
  it('reads PascalCase payloads from ASP.NET defaults', () => {
    const dto = coerceCensusTabCounts({ All: 150, InHouse: 108, ReadyForOt: 12 });
    expect(dto?.all).toBe(150);
    expect(dto?.inHouse).toBe(108);
    expect(dto?.readyForOt).toBe(12);
  });

  it('returns null for missing payloads so the UI can fall back to the list', () => {
    expect(coerceCensusTabCounts(null)).toBeNull();
    expect(coerceCensusTabCounts({})).toBeNull();
  });
});

describe('resolveCensusTabCount', () => {
  it('does not keep all-zero API counts when journeys are already loaded', () => {
    expect(censusTabCountsAreUsable(EMPTY_CENSUS_TAB_COUNTS, 150)).toBe(false);
    expect(resolveCensusTabCount(EMPTY_CENSUS_TAB_COUNTS, 'All', 150, 150)).toBe(150);
    expect(resolveCensusTabCount(EMPTY_CENSUS_TAB_COUNTS, 'InHouse', 108, 150)).toBe(108);
  });

  it('uses server counts when they are populated', () => {
    const counts = { ...EMPTY_CENSUS_TAB_COUNTS, all: 178, inHouse: 108 };
    expect(resolveCensusTabCount(counts, 'All', 10, 10)).toBe(178);
    expect(resolveCensusTabCount(counts, 'InHouse', 4, 10)).toBe(108);
  });

  it('falls back to the client count when the query returned nothing', () => {
    expect(resolveCensusTabCount(null, 'All', 42, 42)).toBe(42);
  });
});
