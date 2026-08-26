'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getIpBillingDashboard, type IpBillingDashboard } from '@/lib/api/opd-billing.api';
import {
  IP_REALTIME_POLL_MS,
  ipRealtimeQueryKeys,
  shouldRefreshIpBilling,
} from '@/lib/ip-management/ip-realtime-events';
import { useNotificationHubInvalidation } from '@/hooks/use-notification-hub-invalidation';

export function useIpBillingDashboardQuery(params: {
  branchId: string | undefined;
  preset: string;
  customFrom: string;
  customTo: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { branchId, preset, customFrom, customTo, enabled = true } = params;

  const query = useQuery({
    queryKey: ipRealtimeQueryKeys.billingDashboard(branchId ?? '', preset, customFrom, customTo),
    enabled: Boolean(branchId) && enabled,
    refetchInterval: IP_REALTIME_POLL_MS,
    staleTime: 10_000,
    queryFn: (): Promise<IpBillingDashboard> =>
      getIpBillingDashboard({
        branchId: branchId!,
        preset,
        from: preset === 'custom' && customFrom ? customFrom : undefined,
        to: preset === 'custom' && customTo ? customTo : undefined,
      }),
  });

  useNotificationHubInvalidation(shouldRefreshIpBilling, () => {
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.billingAll });
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
  });

  return query;
}
