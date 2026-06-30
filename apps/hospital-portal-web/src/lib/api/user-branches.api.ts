import { getApi } from '@/lib/api';
import type { UserBranchesResponse } from '@/types/patient-lookup';

export const userBranchesApi = {
  getMyBranches: async (): Promise<UserBranchesResponse> => {
    const { data } = await getApi().get<UserBranchesResponse>('/user-branches/me');
    return data;
  },
};
