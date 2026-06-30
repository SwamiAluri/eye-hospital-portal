'use client';

import { useCallback, useEffect, useState } from 'react';
import { ipManagementApi, type PreOpClearanceDetailDto } from '@/lib/api/ip-management.api';
import {
  usePreOpClearanceOptional,
  type PreOpClearanceDetailUpdater,
} from '@/components/ip-management/preop/PreOpClearanceProvider';

function clearanceError(raw: unknown): string | undefined {
  return (raw as { error?: string } | null)?.error;
}

export interface UsePreOpClearanceDataOptions {
  journeyId: string;
  paymentMode?: string;
  /** Fires after a mutation refresh (step rail / safety strip). */
  onChanged?: () => void;
}

/**
 * Shared clearance detail for workspace step panels. Uses `PreOpClearanceProvider`
 * when present; falls back to a local init+fetch for legacy surfaces.
 */
export function usePreOpClearanceData({
  journeyId,
  paymentMode,
  onChanged,
}: UsePreOpClearanceDataOptions) {
  const shared = usePreOpClearanceOptional();

  const [localDetail, setLocalDetail] = useState<PreOpClearanceDetailDto | null>(null);
  const [localLoading, setLocalLoading] = useState(!shared);
  const [localError, setLocalError] = useState<string | null>(null);

  const loadLocal = useCallback(async () => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const init = await ipManagementApi.initPreOpClearance(journeyId, {
        paymentModeSnapshot: paymentMode,
      });
      if (!init || clearanceError(init)) {
        setLocalError(
          clearanceError(init) ?? 'Could not initialise pre-op clearance. Check the IP Management service.',
        );
        return;
      }
      const data = await ipManagementApi.getPreOpClearance(journeyId);
      if (!data || clearanceError(data)) {
        setLocalError(
          clearanceError(data) ?? 'Could not load pre-op clearance. Check the IP Management service.',
        );
        return;
      }
      setLocalDetail(data);
    } catch {
      setLocalError('Failed to load pre-op clearance. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  }, [journeyId, paymentMode]);

  useEffect(() => {
    if (!shared) void loadLocal();
  }, [shared, loadLocal]);

  const detail = shared ? shared.detail : localDetail;
  const loading = shared ? shared.loading : localLoading;
  const error = shared ? shared.error : localError;

  const patchDetail = useCallback(
    (next: PreOpClearanceDetailUpdater) => {
      if (shared) {
        shared.patchDetail(next);
      } else {
        setLocalDetail(prev => (typeof next === 'function' ? next(prev) : next));
      }
    },
    [shared],
  );

  const reloadClearance = useCallback(async (): Promise<PreOpClearanceDetailDto | null> => {
    if (shared) {
      const updated = await shared.reload();
      shared.notifyChanged();
      return updated;
    }
    await loadLocal();
    onChanged?.();
    return localDetail;
  }, [shared, loadLocal, localDetail, onChanged]);

  const afterMutation = useCallback(() => {
    if (shared) {
      shared.notifyChanged();
      return;
    }
    onChanged?.();
  }, [shared, onChanged]);

  const retry = useCallback(() => {
    if (shared) void shared.reinitialize();
    else void loadLocal();
  }, [shared, loadLocal]);

  return {
    detail,
    loading,
    error,
    patchDetail,
    reloadClearance,
    afterMutation,
    retry,
    usesSharedClearance: !!shared,
  };
}
