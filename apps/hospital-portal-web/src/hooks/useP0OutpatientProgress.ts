'use client';

import { useEffect, useState } from 'react';
import { ipManagementApi, CounsellorOutpatientChecklistDto } from '@/lib/api/ip-management.api';

export interface P0OutpatientProgress {
  completedItems: number;
  totalItems: number;
  percent: number;
  isIncomplete: boolean;
}

export function useP0OutpatientProgress(
  counselingSessionId?: string | null,
  clinicalState?: string,
): P0OutpatientProgress | null {
  const [p0, setP0] = useState<CounsellorOutpatientChecklistDto | null>(null);

  useEffect(() => {
    if (clinicalState !== 'Expected' || !counselingSessionId) {
      setP0(null);
      return;
    }
    let cancelled = false;
    ipManagementApi.getCounsellorOutpatientChecklist(counselingSessionId)
      .then(data => { if (!cancelled) setP0(data); })
      .catch(() => { if (!cancelled) setP0(null); });
    return () => { cancelled = true; };
  }, [counselingSessionId, clinicalState]);

  if (clinicalState !== 'Expected' || !p0 || p0.totalItems === 0) return null;
  if (p0.completedItems >= p0.totalItems) return null;

  const percent = Math.round((p0.completedItems / p0.totalItems) * 100);
  return {
    completedItems: p0.completedItems,
    totalItems: p0.totalItems,
    percent,
    isIncomplete: true,
  };
}
