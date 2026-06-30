'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userChartLayoutApi } from '@/lib/api/user-chart-layout.api';
import {
  DEFAULT_CHART_LAYOUT,
  parseChartLayout,
  readLocalChartLayout,
  serializeChartLayout,
  writeLocalChartLayout,
  type ChartLayoutConfig,
} from '@/lib/patients/chart-layout';

export const chartLayoutKeys = {
  me: ['user-chart-layout', 'me'] as const,
};

export function useChartLayoutQuery() {
  return useQuery({
    queryKey: chartLayoutKeys.me,
    queryFn: async (): Promise<ChartLayoutConfig> => {
      try {
        const remote = await userChartLayoutApi.getMyLayout();
        if (remote) return parseChartLayout(remote);
      } catch {
        // fall through to local
      }
      return readLocalChartLayout();
    },
    staleTime: 60_000,
  });
}

export type SaveChartLayoutResult = {
  config: ChartLayoutConfig;
  savedToServer: boolean;
};

export function useSaveChartLayoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: ChartLayoutConfig): Promise<SaveChartLayoutResult> => {
      const json = serializeChartLayout(config);
      writeLocalChartLayout(config);
      let savedToServer = false;
      try {
        await userChartLayoutApi.saveMyLayout(json);
        savedToServer = true;
      } catch {
        // local fallback already saved
      }
      return { config, savedToServer };
    },
    onSuccess: ({ config }) => {
      qc.setQueryData(chartLayoutKeys.me, config);
    },
  });
}

export function useChartLayout() {
  const query = useChartLayoutQuery();
  const save = useSaveChartLayoutMutation();
  return {
    layout: query.data ?? DEFAULT_CHART_LAYOUT,
    isLoading: query.isLoading,
    saveLayout: save.mutateAsync,
    isSaving: save.isPending,
  };
}
