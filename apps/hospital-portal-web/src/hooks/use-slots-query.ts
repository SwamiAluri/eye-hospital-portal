'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ipManagementApi, type SlotBoardDto } from '@/lib/api/ip-management.api';
import {
  IP_REALTIME_POLL_MS,
  ipRealtimeQueryKeys,
  shouldRefreshIpDashboard,
} from '@/lib/ip-management/ip-realtime-events';
import { useNotificationHubInvalidation } from '@/hooks/use-notification-hub-invalidation';

export function useSlotsQuery(
  branchId: string | undefined,
  date: string,
  theatreId: string | undefined,
  enabled = true,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ipRealtimeQueryKeys.slots(branchId ?? '', date, theatreId ?? ''),
    enabled: Boolean(branchId) && Boolean(date) && enabled,
    refetchInterval: IP_REALTIME_POLL_MS,
    staleTime: 10_000,
    queryFn: async (): Promise<SlotBoardDto | null> => {
      if (!branchId || !date) return null;
      return ipManagementApi.listSlots({
        branchId,
        date,
        theatreId: theatreId || undefined,
      });
    },
  });

  useNotificationHubInvalidation(shouldRefreshIpDashboard, () => {
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.slotsAll });
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
  });

  return query;
}
