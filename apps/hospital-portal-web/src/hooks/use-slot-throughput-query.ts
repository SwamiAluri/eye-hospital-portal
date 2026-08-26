'use client';

import { useQuery } from '@tanstack/react-query';
import { ipManagementApi, type SlotThroughputDto } from '@/lib/api/ip-management.api';

export function useSlotThroughputQuery(params: {
  branchId: string | undefined;
  from: string;
  to: string;
  theatreId?: string;
  enabled?: boolean;
}) {
  const { branchId, from, to, theatreId, enabled = true } = params;

  return useQuery({
    queryKey: ['ip-slot-throughput', branchId ?? '', from, to, theatreId ?? ''],
    enabled: Boolean(branchId) && Boolean(from) && Boolean(to) && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<SlotThroughputDto | null> => {
      if (!branchId || !from || !to) return null;
      return ipManagementApi.getSlotThroughput({
        branchId,
        from,
        to,
        theatreId: theatreId || undefined,
      });
    },
  });
}
