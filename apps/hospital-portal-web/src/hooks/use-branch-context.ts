'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
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

  const resolveDefaultBranchId = useCallback((): string | null => {
    if (branches.length === 0) return user?.branchId ?? null;
    const defaultBranch = branches.find((b) => b.isDefault);
    return defaultBranch?.branchId ?? branches[0]?.branchId ?? user?.branchId ?? null;
  }, [branches, user?.branchId]);

  /** Prefer explicit selection; fall back to sole authorized branch or login/home branch. */
  const effectiveBranchId =
    selectedBranchId ??
    (branches.length === 1 ? branches[0].branchId : null) ??
    user?.branchId ??
    null;

  // Never call GET /branches/{id} here. It requires branch.view; roles without it
  // receive 403 and the auth interceptor hard-redirects to /dashboard/unauthorized
  // (Lab Technician login refresh loop). Names come from /user-branches/me only.
  const resolvedBranchName =
    branches.find((b) => b.branchId === effectiveBranchId)?.branchName ??
    branches[0]?.branchName ??
    null;

  useEffect(() => {
    if (!user) return;

    const stored = readStoredBranchId();
    if (stored) {
      const storedOk =
        branches.some((b) => b.branchId === stored) ||
        stored === user.branchId ||
        (branches.length === 0 && !branchesQuery.isLoading && stored === user.branchId);
      if (branches.length > 0 && branches.some((b) => b.branchId === stored)) {
        if (selectedBranchId !== stored) setSelectedBranchId(stored);
        return;
      }
      if (branches.length === 0 && user.branchId && stored === user.branchId) {
        if (selectedBranchId !== stored) setSelectedBranchId(stored);
        return;
      }
      void storedOk;
    }

    const fallback = resolveDefaultBranchId();
    if (fallback && fallback !== selectedBranchId) {
      setSelectedBranchId(fallback);
      writeStoredBranchId(fallback);
    }
  }, [
    user,
    branches,
    branchesQuery.isLoading,
    selectedBranchId,
    setSelectedBranchId,
    resolveDefaultBranchId,
  ]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.branchId === effectiveBranchId) ?? null,
    [branches, effectiveBranchId],
  );

  const selectBranch = useCallback(
    (branchId: string) => {
      setSelectedBranchId(branchId);
      writeStoredBranchId(branchId);
    },
    [setSelectedBranchId],
  );

  return {
    branchId: effectiveBranchId,
    branches,
    activeBranch,
    branchName: resolvedBranchName,
    selectBranch,
    isLoading: branchesQuery.isLoading && !effectiveBranchId,
    isReady: !!effectiveBranchId,
    error: branchesQuery.error,
  };
}
