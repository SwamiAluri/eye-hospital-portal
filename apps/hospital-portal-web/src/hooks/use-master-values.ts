'use client';
import { useState, useEffect, useCallback } from 'react';
import { masterValuesApi } from '@/lib/api';

export interface MasterOption {
  /** Stored value — equals the master_value.code */
  value: string;
  /** Display label */
  label: string;
  /** Parsed metadata JSON from master_value (e.g. isAbnormal, advancePercentage) */
  metadata?: Record<string, unknown>;
  sortOrder?: number;
}

type MasterLookupRow = {
  code: string;
  label: string;
  metadata?: Record<string, unknown> | null;
  sortOrder?: number;
};

function mapLookupRows(raw: MasterLookupRow[]): MasterOption[] {
  return raw.map((mv) => ({
    value: mv.code,
    label: mv.label,
    metadata: (mv.metadata as Record<string, unknown> | undefined) ?? undefined,
    sortOrder: mv.sortOrder,
  }));
}

// ── Module-level cache/dedup ─────────────────────────────────────────────────
const _cache = new Map<string, MasterOption[]>();
const _pending = new Map<string, Promise<MasterOption[]>>();
const _listeners = new Map<string, Set<() => void>>();

function _notify(entityType: string): void {
  _listeners.get(entityType)?.forEach((fn) => fn());
}

async function _fetch(entityType: string): Promise<MasterOption[]> {
  if (_cache.has(entityType)) return _cache.get(entityType)!;
  if (_pending.has(entityType)) return _pending.get(entityType)!;

  const promise = masterValuesApi
    .lookup(entityType)
    .then((res) => {
      const raw = res.data?.items ?? res.data?.Items ?? [];
      const items = mapLookupRows(raw as MasterLookupRow[]);
      _cache.set(entityType, items);
      return items;
    })
    .finally(() => _pending.delete(entityType));

  _pending.set(entityType, promise);
  return promise;
}

/**
 * Fetch master values for a given entity type (dropdown lookup API).
 *
 * - Uses GET /master-values/lookup/{entityType} (master_data.lookup permission).
 * - Caches in module scope; invalidated when Master Data admin CRUD runs.
 * - Returns empty options on API failure (no hardcoded fallbacks).
 */
export function useMasterValues(entityType: string): {
  options: MasterOption[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
} {
  const [options, setOptions] = useState<MasterOption[]>(() => _cache.get(entityType) ?? []);
  const [loading, setLoading] = useState(!_cache.has(entityType));
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    _cache.delete(entityType);
    try {
      const items = await _fetch(entityType);
      setOptions(items);
    } catch {
      setOptions([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    let cancelled = false;

    if (_cache.has(entityType)) {
      setOptions(_cache.get(entityType)!);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    _fetch(entityType)
      .then((items) => {
        if (cancelled) return;
        setOptions(items);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const onInvalidate = () => {
      if (!cancelled) void load();
    };
    if (!_listeners.has(entityType)) _listeners.set(entityType, new Set());
    _listeners.get(entityType)!.add(onInvalidate);

    return () => {
      cancelled = true;
      _listeners.get(entityType)?.delete(onInvalidate);
    };
  }, [entityType, load]);

  return { options, loading, error, refetch: load };
}

/** Invalidate cache for one entity type and refresh subscribed hooks. */
export function invalidateMasterCache(entityType: string): void {
  _cache.delete(entityType);
  _pending.delete(entityType);
  _notify(entityType);
}

/** Invalidate all cached entity types (e.g. after bulk seed). */
export function invalidateAllMasterCache(): void {
  const types = [...new Set([..._cache.keys(), ..._listeners.keys()])];
  _cache.clear();
  _pending.clear();
  types.forEach(_notify);
}
