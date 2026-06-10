import { getApi } from '../api';
import type {
  CounsellingPackageTemplate,
  CounsellingSettings,
  CreateCounsellingPackageTemplateRequest,
  UpdateCounsellingPackageTemplateRequest,
} from '@/types/counselling-estimate';

export const counsellingPackageTemplatesApi = {
  getAll: async (params?: {
    category?: string;
    isActive?: boolean;
  }): Promise<CounsellingPackageTemplate[]> => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.isActive !== undefined) query.append('isActive', String(params.isActive));
    const suffix = query.toString() ? `?${query}` : '';
    const res = await getApi().get<CounsellingPackageTemplate[]>(
      `/counselling-package-templates${suffix}`,
    );
    return res.data ?? [];
  },

  getById: async (id: string): Promise<CounsellingPackageTemplate> => {
    const res = await getApi().get<CounsellingPackageTemplate>(
      `/counselling-package-templates/${id}`,
    );
    return res.data;
  },

  getByCode: async (code: string): Promise<CounsellingPackageTemplate> => {
    const res = await getApi().get<CounsellingPackageTemplate>(
      `/counselling-package-templates/by-code/${encodeURIComponent(code)}`,
    );
    return res.data;
  },

  getSettings: async (): Promise<CounsellingSettings> => {
    const res = await getApi().get<CounsellingSettings>(
      '/counselling-package-templates/settings',
    );
    return res.data ?? { maxDiscountPercent: 50 };
  },

  updateSettings: async (body: CounsellingSettings): Promise<CounsellingSettings> => {
    const res = await getApi().put<CounsellingSettings>(
      '/counselling-package-templates/settings',
      body,
    );
    return res.data;
  },

  create: async (
    body: CreateCounsellingPackageTemplateRequest,
  ): Promise<CounsellingPackageTemplate> => {
    const res = await getApi().post<CounsellingPackageTemplate>(
      '/counselling-package-templates',
      body,
    );
    return res.data;
  },

  update: async (
    id: string,
    body: UpdateCounsellingPackageTemplateRequest,
  ): Promise<CounsellingPackageTemplate> => {
    const res = await getApi().put<CounsellingPackageTemplate>(
      `/counselling-package-templates/${id}`,
      body,
    );
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await getApi().delete(`/counselling-package-templates/${id}`);
  },
};
