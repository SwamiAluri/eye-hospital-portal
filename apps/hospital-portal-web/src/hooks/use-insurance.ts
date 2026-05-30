/**
 * @deprecated Legacy insurance hooks — no longer imported by any active component.
 * All new insurance/CCMS flows use hooks in src/hooks/useCcmsPermissions.ts and
 * the CCMS API clients under src/lib/api/ccms/.
 * This file is retained for reference only and will be removed in a future cleanup pass.
 */
// Insurance Module Hooks - Module 3.6
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/lib/api';
import type {
  InsurancePreAuth,
  InsuranceClaim,
  CreatePreAuthRequest,
  PreAuthListResponse,
} from '@/types/counselor';

// ==================== Pre-Authorization Hooks ====================

export function usePreAuths(sessionId?: string, status?: string, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['insurance', 'pre-auths', sessionId, status, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sessionId) params.append('sessionId', sessionId);
      if (status) params.append('status', status);
      params.append('pageNumber', page.toString());
      params.append('pageSize', pageSize.toString());
      
      const response = await getApi().get<PreAuthListResponse>(`/insurance/pre-auths?${params}`);
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

export function usePreAuth(id: string) {
  return useQuery({
    queryKey: ['insurance', 'pre-auth', id],
    queryFn: async () => {
      const response = await getApi().get<InsurancePreAuth>(`/insurance/pre-auths/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

export function useCreatePreAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreatePreAuthRequest) => {
      const response = await getApi().post<InsurancePreAuth>('/insurance/pre-auths', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance', 'pre-auths'] });
    },
  });
}

export function useUpdatePreAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePreAuthRequest> }) => {
      const response = await getApi().put<InsurancePreAuth>(`/insurance/pre-auths/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['insurance', 'pre-auths'] });
      queryClient.invalidateQueries({ queryKey: ['insurance', 'pre-auth', variables.id] });
    },
  });
}

export function useDeletePreAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await getApi().delete(`/insurance/pre-auths/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance', 'pre-auths'] });
    },
  });
}

// ==================== Claims Hooks ====================

export function useClaims(sessionId?: string, status?: string, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['insurance', 'claims', sessionId, status, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sessionId) params.append('sessionId', sessionId);
      if (status) params.append('status', status);
      params.append('pageNumber', page.toString());
      params.append('pageSize', pageSize.toString());
      
      const response = await getApi().get(`/insurance/claims?${params}`);
      return response.data;
    },
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ['insurance', 'claim', id],
    queryFn: async () => {
      const response = await getApi().get<InsuranceClaim>(`/insurance/claims/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await getApi().post<InsuranceClaim>('/insurance/claims', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance', 'claims'] });
    },
  });
}

export function useUpdateClaim() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await getApi().put<InsuranceClaim>(`/insurance/claims/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      queryClient.invalidateQueries({ queryKey: ['insurance', 'claim', variables.id] });
    },
  });
}
