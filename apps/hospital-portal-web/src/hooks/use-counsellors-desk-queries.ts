'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { serviceCatalogApi } from '@/lib/api/service-catalog.api';
import { usersApi } from '@/lib/api';
import type { WaitingListFilters } from '@/types/counsellors-desk';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import {
  counsellorsDeskKeys,
  CATALOG_STALE_MS,
  LIST_STALE_MS,
  SESSION_STALE_MS,
} from '@/lib/counsellors-desk/counsellors-desk-query-keys';

export { counsellorsDeskKeys } from '@/lib/counsellors-desk/counsellors-desk-query-keys';

export function useWaitingListQuery(filters?: WaitingListFilters) {
  return useQuery({
    queryKey: counsellorsDeskKeys.waitingList(filters),
    queryFn: () => counsellorsDeskApi.getWaitingList(filters),
    staleTime: LIST_STALE_MS,
  });
}

export type FinalizeListFilters = { date: string; uhid: string; name: string };

export function useFinalizeListQuery(filters: FinalizeListFilters) {
  return useQuery({
    queryKey: counsellorsDeskKeys.finalizeList(filters),
    queryFn: () => counsellorsDeskApi.getFinalizeList({
      date: filters.date || undefined,
      uhid: filters.uhid || undefined,
      name: filters.name || undefined,
    }),
    staleTime: LIST_STALE_MS,
  });
}

export function useCounsellingSessionQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: counsellorsDeskKeys.session(sessionId),
    queryFn: () => counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true }),
    staleTime: SESSION_STALE_MS,
    enabled: !!sessionId && enabled,
  });
}

export function useSurgeonsQuery(enabled = false) {
  return useQuery({
    queryKey: counsellorsDeskKeys.surgeons(),
    queryFn: () => counsellorsDeskApi.getSurgeons(),
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}

export function useCounsellorsMasterCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: counsellorsDeskKeys.masterCatalog(),
    queryFn: () => counsellorsDeskApi.getMasterCatalog(),
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}

export function useServiceCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: counsellorsDeskKeys.serviceCatalog(),
    queryFn: () => serviceCatalogApi.getFullCatalog(),
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}

export function useStaffDirectoryQuery(enabled = false) {
  return useQuery({
    queryKey: counsellorsDeskKeys.staffDirectory(),
    queryFn: async () => {
      const res = await usersApi.getAllWithDetails();
      const data = res.data as Array<{
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
      }>;
      return (data ?? []).map(u => ({
        id: u.id,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email: u.email,
        phoneNumber: u.phoneNumber,
      }));
    },
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}

const PAGE_SIZE = 20;

export function useActiveFollowupsQuery(page: number, enabled = true) {
  return useQuery({
    queryKey: counsellorsDeskKeys.activeFollowups(page, PAGE_SIZE),
    queryFn: () => counsellorsDeskApi.getActiveFollowups({ page, pageSize: PAGE_SIZE }),
    staleTime: LIST_STALE_MS,
    enabled,
  });
}

export function useColdLeadsQuery(page: number, enabled = true) {
  return useQuery({
    queryKey: counsellorsDeskKeys.coldLeads(page, PAGE_SIZE),
    queryFn: () => counsellorsDeskApi.getColdLeads({ page, pageSize: PAGE_SIZE }),
    staleTime: LIST_STALE_MS,
    enabled,
  });
}

export function usePostSurgeryFollowupsQuery(page: number, enabled = true) {
  return useQuery({
    queryKey: counsellorsDeskKeys.postSurgeryFollowups(page, PAGE_SIZE),
    queryFn: () => counsellorsDeskApi.getPostSurgeryFollowups({ page, pageSize: PAGE_SIZE }),
    staleTime: LIST_STALE_MS,
    enabled,
  });
}

export function useInvalidateCounsellorsDesk() {
  const queryClient = useQueryClient();
  return {
    invalidateWaitingList: () =>
      queryClient.invalidateQueries({ queryKey: [...counsellorsDeskKeys.all, 'waiting-list'] }),
    invalidateFinalizeList: () =>
      queryClient.invalidateQueries({ queryKey: [...counsellorsDeskKeys.all, 'finalize-list'] }),
    invalidateSession: (sessionId: string) =>
      queryClient.invalidateQueries({ queryKey: counsellorsDeskKeys.session(sessionId) }),
    patchFinalizeRecord: (filters: FinalizeListFilters, id: string, patch: Partial<FinalizeSurgeryRecord>) => {
      queryClient.setQueryData<FinalizeSurgeryRecord[]>(
        counsellorsDeskKeys.finalizeList(filters),
        old => (old ?? []).map(r => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    replaceFinalizeRecords: (filters: FinalizeListFilters, records: FinalizeSurgeryRecord[]) => {
      queryClient.setQueryData(counsellorsDeskKeys.finalizeList(filters), records);
    },
    invalidateAll: () =>
      queryClient.invalidateQueries({ queryKey: counsellorsDeskKeys.all }),
  };
}
