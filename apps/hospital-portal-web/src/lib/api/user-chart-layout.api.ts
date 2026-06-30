import { getApi } from '@/lib/api';

export const userChartLayoutApi = {
  getMyLayout: async (): Promise<string | null> => {
    const { data } = await getApi().get<{ layoutJson?: string | null }>('/user-chart-layout/me');
    return data?.layoutJson ?? null;
  },

  saveMyLayout: async (layoutJson: string): Promise<void> => {
    await getApi().put('/user-chart-layout/me', { layoutJson });
  },
};
