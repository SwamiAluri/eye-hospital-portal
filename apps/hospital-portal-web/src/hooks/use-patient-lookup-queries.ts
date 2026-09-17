'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import {
  readRecentPatientsLocal,
  recordRecentPatientLocal,
} from '@/lib/patients/patient-recent-views-storage';
import type { PatientLookupFilters, PatientRecentViewEntry } from '@/types/patient-lookup';

const LIST_STALE_MS = 30_000;

export const patientLookupKeys = {
  all: ['patient-lookup'] as const,
  lookup: (filters: PatientLookupFilters) => [...patientLookupKeys.all, 'lookup', filters] as const,
  stats: (branchId: string) => [...patientLookupKeys.all, 'stats', branchId] as const,
  suggest: (branchId: string, q: string) => [...patientLookupKeys.all, 'suggest', branchId, q] as const,
  summary: (patientId: string, branchId: string, skipPhiAudit?: boolean) =>
    [...patientLookupKeys.all, 'summary', patientId, branchId, skipPhiAudit ?? false] as const,
  recentVisits: (patientId: string, branchId: string) =>
    [...patientLookupKeys.all, 'recent-visits', patientId, branchId] as const,
  recentViews: () => [...patientLookupKeys.all, 'recent-views'] as const,
};

export function usePatientLookupQuery(filters: PatientLookupFilters, enabled = true) {
  return useQuery({
    queryKey: patientLookupKeys.lookup(filters),
    queryFn: () => patientLookupApi.lookup(filters),
    staleTime: LIST_STALE_MS,
    // branchId optional — server ResolveEffectiveBranchAsync when omitted (single-branch users)
    enabled,
  });
}

export function usePatientLookupStatsQuery(branchId: string | null, enabled = true) {
  return useQuery({
    queryKey: patientLookupKeys.stats(branchId ?? ''),
    queryFn: () => patientLookupApi.stats(branchId ?? ''),
    staleTime: LIST_STALE_MS,
    enabled,
  });
}

export function usePatientSuggestQuery(branchId: string | null, q: string, enabled = true) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: patientLookupKeys.suggest(branchId ?? '', trimmed),
    queryFn: () => patientLookupApi.suggest(branchId ?? '', trimmed),
    staleTime: 15_000,
    enabled: enabled && trimmed.length >= 2,
  });
}

export function useTogglePatientFavoriteMutation(branchId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) => patientLookupApi.toggleFavorite(patientId),
    onSuccess: () => {
      if (!branchId) return;
      qc.invalidateQueries({ queryKey: patientLookupKeys.all });
    },
  });
}

export function usePatientSummaryQuery(
  patientId: string | null,
  branchId: string | null,
  options?: { skipPhiAudit?: boolean; enabled?: boolean },
) {
  const skipPhiAudit = options?.skipPhiAudit ?? false;
  return useQuery({
    queryKey: patientLookupKeys.summary(patientId ?? '', branchId ?? '', skipPhiAudit),
    queryFn: () => patientLookupApi.getSummary(patientId!, branchId!, { skipPhiAudit }),
    enabled: (options?.enabled ?? true) && !!patientId && !!branchId,
    staleTime: 30_000,
    retry: false,
  });
}

export function usePatientRecentVisitsQuery(patientId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: patientLookupKeys.recentVisits(patientId ?? '', branchId ?? ''),
    queryFn: () => patientLookupApi.getRecentVisits(patientId!, branchId!, 5),
    enabled: !!patientId && !!branchId,
    staleTime: 30_000,
  });
}

export function usePatientRecentViewsQuery(enabled = true) {
  return useQuery({
    queryKey: patientLookupKeys.recentViews(),
    queryFn: async (): Promise<PatientRecentViewEntry[]> => {
      try {
        return await patientLookupApi.getRecentViews(6);
      } catch {
        return readRecentPatientsLocal(6);
      }
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useRecordPatientRecentViewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<PatientRecentViewEntry, 'viewedAt'>) => {
      try {
        await patientLookupApi.recordRecentView(entry.patientId);
      } catch {
        recordRecentPatientLocal(entry);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientLookupKeys.recentViews() });
    },
  });
}
