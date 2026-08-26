'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ipManagementApi,
  type PatientJourneyRowDto,
  type WardDashboardSummaryDto,
  type WardDto,
  type WardBedDto,
} from '@/lib/api/ip-management.api';
import {
  IP_REALTIME_POLL_MS,
  ipRealtimeQueryKeys,
  shouldRefreshWardBoard,
} from '@/lib/ip-management/ip-realtime-events';
import { useNotificationHubInvalidation } from '@/hooks/use-notification-hub-invalidation';

export type WardBoardData = {
  journeys: PatientJourneyRowDto[];
  wards: WardDto[];
};

export function patchWardJourney(
  queryClient: QueryClient,
  branchId: string,
  journeyId: string,
  patch: Partial<PatientJourneyRowDto>,
) {
  queryClient.setQueryData<WardBoardData>(
    ipRealtimeQueryKeys.wardBoard(branchId),
    (old) => {
      if (!old) return old;
      return {
        ...old,
        journeys: old.journeys.map(row => (row.id === journeyId ? { ...row, ...patch } : row)),
      };
    },
  );
}

export function useWardBoardQuery(
  branchId: string | undefined,
  options?: { pauseRefresh?: boolean },
) {
  const pauseRefresh = options?.pauseRefresh ?? false;
  const queryClient = useQueryClient();

  const board = useQuery({
    queryKey: ipRealtimeQueryKeys.wardBoard(branchId ?? ''),
    enabled: Boolean(branchId),
    refetchInterval: pauseRefresh ? false : IP_REALTIME_POLL_MS,
    refetchOnWindowFocus: !pauseRefresh,
    staleTime: 10_000,
    queryFn: (): Promise<WardBoardData> => ipManagementApi.fetchWardData(branchId!),
  });

  const summary = useQuery({
    queryKey: ipRealtimeQueryKeys.wardSummary(branchId ?? ''),
    enabled: Boolean(branchId),
    refetchInterval: pauseRefresh ? false : IP_REALTIME_POLL_MS,
    refetchOnWindowFocus: !pauseRefresh,
    staleTime: 10_000,
    queryFn: (): Promise<WardDashboardSummaryDto | null> =>
      ipManagementApi.fetchWardDashboardSummary(branchId!).catch(() => null),
  });

  useNotificationHubInvalidation(shouldRefreshWardBoard, () => {
    if (pauseRefresh) return;
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.wardBoardAll });
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.wardSummary(branchId ?? '') });
  });

  return { board, summary, queryClient };
}

export function useWardBedsQuery(
  wardId: string | undefined,
  options?: { pauseRefresh?: boolean },
) {
  const pauseRefresh = options?.pauseRefresh ?? false;
  const queryClient = useQueryClient();

  const beds = useQuery({
    queryKey: ipRealtimeQueryKeys.wardBeds(wardId ?? ''),
    enabled: Boolean(wardId),
    refetchInterval: pauseRefresh ? false : IP_REALTIME_POLL_MS,
    refetchOnWindowFocus: !pauseRefresh,
    staleTime: 10_000,
    queryFn: (): Promise<WardBedDto[]> => ipManagementApi.getBedAvailability(wardId!),
  });

  useNotificationHubInvalidation(shouldRefreshWardBoard, () => {
    if (pauseRefresh) return;
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.wardBedsAll });
  });

  return beds;
}
