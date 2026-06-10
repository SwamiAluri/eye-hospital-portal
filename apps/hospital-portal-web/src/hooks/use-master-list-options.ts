'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

/** Master-driven string list with TS fallback when master is empty (B5–B8 pattern). */
export function useMasterListOptions(entityType: string, fallback: readonly string[]) {
  const { options, loading, error } = useMasterValues(entityType);
  const labels = useMemo(() => {
    const fromMaster = options.map((o) => o.label);
    if (fromMaster.length === 0) return [...fallback];
    const seen = new Set(fromMaster);
    const merged = [...fromMaster];
    for (const f of fallback) {
      if (!seen.has(f)) merged.push(f);
    }
    return merged;
  }, [options, fallback]);
  return { labels, options, loading, error, fromMaster: options.length > 0 };
}
