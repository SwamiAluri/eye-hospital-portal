'use client';

import { useQuery } from '@tanstack/react-query';
import { ipManagementApi, type CensusTabCountsDto } from '@/lib/api/ip-management.api';
import { ipRealtimeQueryKeys } from '@/lib/ip-management/ip-realtime-events';
import type { IpDashboardTab } from '@/lib/ip-management/ip-dashboard-tabs';

export const EMPTY_CENSUS_TAB_COUNTS: CensusTabCountsDto = {
  all: 0,
  inHouse: 0,
  readyForOt: 0,
  sentToOt: 0,
  inOt: 0,
  postOp: 0,
  readyForDischarge: 0,
  discharged: 0,
  cancelled: 0,
};

/** Accept camelCase or PascalCase payloads from the IP service. */
export function coerceCensusTabCounts(raw: unknown): CensusTabCountsDto | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const n = (camel: string, pascal: string): number | undefined => {
    const v = o[camel] ?? o[pascal];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    return undefined;
  };
  const all = n('all', 'All');
  const inHouse = n('inHouse', 'InHouse');
  if (all == null && inHouse == null) return null;
  return {
    all: all ?? 0,
    inHouse: inHouse ?? 0,
    readyForOt: n('readyForOt', 'ReadyForOt') ?? 0,
    sentToOt: n('sentToOt', 'SentToOt') ?? 0,
    inOt: n('inOt', 'InOt') ?? 0,
    postOp: n('postOp', 'PostOp') ?? 0,
    readyForDischarge: n('readyForDischarge', 'ReadyForDischarge') ?? 0,
    discharged: n('discharged', 'Discharged') ?? 0,
    cancelled: n('cancelled', 'Cancelled') ?? 0,
  };
}

export function censusCountForTab(
  counts: CensusTabCountsDto | null | undefined,
  tab: IpDashboardTab,
): number | undefined {
  if (!counts) return undefined;
  switch (tab) {
    case 'All': return counts.all;
    case 'InHouse': return counts.inHouse;
    case 'ReadyForOt': return counts.readyForOt;
    case 'SentToOt': return counts.sentToOt;
    case 'InOt': return counts.inOt;
    case 'PostOp': return counts.postOp;
    case 'ReadyForDischarge': return counts.readyForDischarge;
    case 'Discharged': return counts.discharged;
    case 'Cancelled': return counts.cancelled;
    default: return counts.all;
  }
}

/**
 * An all-zero DTO is indistinguishable from the empty fallback used when the
 * tab-counts API is down. `0` is not nullish, so `server ?? client` would keep
 * showing 0 while the census table is full.
 */
export function censusTabCountsAreUsable(
  counts: CensusTabCountsDto | null | undefined,
  loadedJourneyCount: number,
): counts is CensusTabCountsDto {
  if (!counts) return false;
  if (counts.all === 0 && loadedJourneyCount > 0) return false;
  return true;
}

export function resolveCensusTabCount(
  counts: CensusTabCountsDto | null | undefined,
  tab: IpDashboardTab,
  clientCount: number,
  loadedJourneyCount: number,
): number {
  if (!censusTabCountsAreUsable(counts, loadedJourneyCount)) return clientCount;
  const server = censusCountForTab(counts, tab);
  return server ?? clientCount;
}

export function useCensusTabCountsQuery(branchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ipRealtimeQueryKeys.censusTabCounts(branchId ?? ''),
    enabled: Boolean(branchId) && enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const dto = await ipManagementApi.getCensusTabCounts(branchId!);
      return coerceCensusTabCounts(dto);
    },
  });
}
