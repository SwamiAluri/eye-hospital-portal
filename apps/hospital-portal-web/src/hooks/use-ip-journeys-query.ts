'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ipManagementApi, type PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import {
  IP_REALTIME_POLL_MS,
  ipRealtimeQueryKeys,
  shouldRefreshIpDashboard,
} from '@/lib/ip-management/ip-realtime-events';
import { useNotificationHubInvalidation } from '@/hooks/use-notification-hub-invalidation';

export function patchCensusJourney(
  queryClient: QueryClient,
  journeyId: string,
  patch: Partial<PatientJourneyRowDto>,
) {
  queryClient.setQueriesData<PatientJourneyRowDto[]>(
    { queryKey: ipRealtimeQueryKeys.journeysAll },
    (old) => {
      if (!Array.isArray(old)) return old;
      return old.map(row => (row.id === journeyId ? { ...row, ...patch } : row));
    },
  );
}

export function useIpJourneysQuery(
  branchId: string | undefined,
  filters: { fromDate: string; toDate: string; uhid: string; search: string },
  enabled = true,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ipRealtimeQueryKeys.journeys(branchId ?? '', filters),
    enabled: Boolean(branchId) && enabled,
    refetchInterval: IP_REALTIME_POLL_MS,
    staleTime: 10_000,
    queryFn: async (): Promise<PatientJourneyRowDto[]> => {
      const data = await ipManagementApi.listJourneys({
        branchId,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        uhid: filters.uhid || undefined,
        patientName: filters.search || undefined,
      });
      return Array.isArray(data) ? data : [];
    },
  });

  useNotificationHubInvalidation(shouldRefreshIpDashboard, () => {
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.billingAll });
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.slotsAll });
    void queryClient.invalidateQueries({ queryKey: ['ip-management', 'census-tab-counts'] });
  });

  return query;
}
