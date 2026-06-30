'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { getApi } from '@/lib/api';
import { userBranchesApi } from '@/lib/api/user-branches.api';
import type { UserBranchAssignment } from '@/types/patient-lookup';

const STORAGE_KEY = 'selected_branch_id';

export const branchContextKeys = {
  myBranches: ['user-branches', 'me'] as const,
};

function readStoredBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

function writeStoredBranchId(branchId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, branchId);
}

export function useBranchContext() {
  const user = useAuthStore((s) => s.user);
  const selectedBranchId = useAuthStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useAuthStore((s) => s.setSelectedBranchId);

  const branchesQuery = useQuery({
    queryKey: branchContextKeys.myBranches,
    queryFn: () => userBranchesApi.getMyBranches(),
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  const branches: UserBranchAssignment[] = branchesQuery.data?.branches ?? [];

  const branchDetailsQuery = useQuery({
    queryKey: ['branch-details', selectedBranchId],
    queryFn: async () => {
      const { data } = await getApi().get(`/branches/${selectedBranchId}`);
      return data as { branchName?: string; name?: string; branchCode?: string; code?: string };
    },
    staleTime: 5 * 60_000,
    enabled: !!selectedBranchId && branches.length === 0 && !branchesQuery.isLoading,
  });

  const resolvedBranchName =
    branches[0]?.branchName ??
    branchDetailsQuery.data?.branchName ??
    branchDetailsQuery.data?.name ??
    null;

  const resolveDefaultBranchId = useCallback((): string | null => {
    if (branches.length === 0) return user?.branchId ?? null;
    const defaultBranch = branches.find((b) => b.isDefault);
    return defaultBranch?.branchId ?? branches[0]?.branchId ?? user?.branchId ?? null;
  }, [branches, user?.branchId]);

  useEffect(() => {
    if (!user) return;

    const stored = readStoredBranchId();
    if (stored && branches.some((b) => b.branchId === stored)) {
      if (selectedBranchId !== stored) setSelectedBranchId(stored);
      return;
    }

    const fallback = resolveDefaultBranchId();
    if (fallback && fallback !== selectedBranchId) {
      setSelectedBranchId(fallback);
      writeStoredBranchId(fallback);
    }
  }, [user, branches, selectedBranchId, setSelectedBranchId, resolveDefaultBranchId]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.branchId === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const selectBranch = useCallback(
    (branchId: string) => {
      setSelectedBranchId(branchId);
      writeStoredBranchId(branchId);
    },
    [setSelectedBranchId],
  );

  return {
    branchId: selectedBranchId,
    branches,
    activeBranch,
    branchName: resolvedBranchName,
    selectBranch,
    isLoading: branchesQuery.isLoading,
    isReady: !!selectedBranchId,
    error: branchesQuery.error,
  };
}
