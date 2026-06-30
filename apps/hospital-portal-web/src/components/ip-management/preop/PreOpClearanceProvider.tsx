'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ipManagementApi, type PreOpClearanceDetailDto } from '@/lib/api/ip-management.api';

export type PreOpClearanceDetailUpdater =
  | PreOpClearanceDetailDto
  | null
  | ((prev: PreOpClearanceDetailDto | null) => PreOpClearanceDetailDto | null);

export interface PreOpClearanceContextValue {
  journeyId: string;
  paymentMode?: string;
  detail: PreOpClearanceDetailDto | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch clearance detail (after a mutation). */
  reload: () => Promise<PreOpClearanceDetailDto | null>;
  /** Re-run init + fetch (error recovery / journey change). */
  reinitialize: () => Promise<void>;
  patchDetail: (next: PreOpClearanceDetailUpdater) => void;
  notifyChanged: () => void;
  registerOnChanged: (listener: () => void) => () => void;
}

const PreOpClearanceContext = createContext<PreOpClearanceContextValue | null>(null);

function clearanceError(raw: unknown): string | undefined {
  return (raw as { error?: string } | null)?.error;
}

export function usePreOpClearance(): PreOpClearanceContextValue {
  const ctx = useContext(PreOpClearanceContext);
  if (!ctx) {
    throw new Error('usePreOpClearance must be used within PreOpClearanceProvider');
  }
  return ctx;
}

/** Returns null outside the workspace provider (legacy surfaces keep their own fetch). */
export function usePreOpClearanceOptional(): PreOpClearanceContextValue | null {
  return useContext(PreOpClearanceContext);
}

export interface PreOpClearanceProviderProps {
  journeyId: string;
  paymentMode?: string;
  children: ReactNode;
}

/**
 * Single shared §2 pre-op clearance load for the Ward Pre-Op Workspace (Phase 3).
 * One init + get on open; panels read via `usePreOpClearance` / `usePreOpClearanceData`.
 */
export function PreOpClearanceProvider({
  journeyId,
  paymentMode,
  children,
}: PreOpClearanceProviderProps) {
  const [detail, setDetail] = useState<PreOpClearanceDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const registerOnChanged = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const notifyChanged = useCallback(() => {
    listenersRef.current.forEach(fn => fn());
  }, []);

  const patchDetail = useCallback((next: PreOpClearanceDetailUpdater) => {
    setDetail(prev => (typeof next === 'function' ? next(prev) : next));
  }, []);

  const reload = useCallback(async (): Promise<PreOpClearanceDetailDto | null> => {
    try {
      const data = await ipManagementApi.getPreOpClearance(journeyId);
      const err = clearanceError(data);
      if (!data || err) return null;
      setDetail(data);
      return data;
    } catch {
      return null;
    }
  }, [journeyId]);

  const reinitialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const init = await ipManagementApi.initPreOpClearance(journeyId, {
        paymentModeSnapshot: paymentMode,
      });
      const initErr = clearanceError(init);
      if (!init || initErr) {
        setError(
          initErr
            ?? 'Could not initialise pre-op clearance. Check the IP Management service is running.',
        );
        setDetail(null);
        return;
      }
      const data = await ipManagementApi.getPreOpClearance(journeyId);
      const dataErr = clearanceError(data);
      if (!data || dataErr) {
        setError(
          dataErr
            ?? 'Could not load pre-op clearance. Check the IP Management service is running.',
        );
        setDetail(null);
        return;
      }
      setDetail(data);
    } catch {
      setError('Failed to load pre-op clearance. Please try again.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [journeyId, paymentMode]);

  useEffect(() => {
    void reinitialize();
  }, [reinitialize]);

  const value: PreOpClearanceContextValue = {
    journeyId,
    paymentMode,
    detail,
    loading,
    error,
    reload,
    reinitialize,
    patchDetail,
    notifyChanged,
    registerOnChanged,
  };

  return (
    <PreOpClearanceContext.Provider value={value}>{children}</PreOpClearanceContext.Provider>
  );
}

/** Subscribes the readiness rollup (and other listeners) to shared clearance mutations. */
export function PreOpClearanceChangedBridge({ onChanged }: { onChanged: () => void }) {
  const { registerOnChanged } = usePreOpClearance();
  useEffect(() => registerOnChanged(onChanged), [registerOnChanged, onChanged]);
  return null;
}
