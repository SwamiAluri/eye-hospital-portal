import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { counsellingPackageTemplatesApi } from '@/lib/api/counselling-package-templates.api';
import type {
  CounsellingPackageTemplate,
  CounsellingSettings,
  CreateCounsellingPackageTemplateRequest,
  UpdateCounsellingPackageTemplateRequest,
} from '@/types/counselling-estimate';

export function useCounsellingPackageTemplates(params?: {
  category?: string;
  isActive?: boolean;
}) {
  return useQuery<CounsellingPackageTemplate[]>({
    queryKey: ['counselling-package-templates', params?.category, params?.isActive],
    queryFn: () => counsellingPackageTemplatesApi.getAll(params),
    staleTime: 60_000,
  });
}

export function useCounsellingPackageTemplate(id: string | null | undefined) {
  return useQuery<CounsellingPackageTemplate>({
    queryKey: ['counselling-package-template', id],
    queryFn: () => counsellingPackageTemplatesApi.getById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCounsellingSettings() {
  return useQuery<CounsellingSettings>({
    queryKey: ['counselling-settings'],
    queryFn: () => counsellingPackageTemplatesApi.getSettings(),
    staleTime: 120_000,
  });
}

export function useCreateCounsellingPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCounsellingPackageTemplateRequest) =>
      counsellingPackageTemplatesApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counselling-package-templates'] });
    },
  });
}

export function useUpdateCounsellingPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCounsellingPackageTemplateRequest }) =>
      counsellingPackageTemplatesApi.update(id, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['counselling-package-templates'] });
      void qc.invalidateQueries({ queryKey: ['counselling-package-template', vars.id] });
    },
  });
}

export function useDeleteCounsellingPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => counsellingPackageTemplatesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counselling-package-templates'] });
    },
  });
}

export function useUpdateCounsellingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CounsellingSettings) =>
      counsellingPackageTemplatesApi.updateSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counselling-settings'] });
    },
  });
}
