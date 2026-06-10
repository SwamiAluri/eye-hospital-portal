'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

const FALLBACK_POSTOP_CHECKLIST = [
  'Vitals Stable',
  'Eye Padded',
  'Medication Given',
  'Diet Advice Given',
  'Discharge Note Issued',
  'Follow-Up Appointment Set',
] as const;

/** B6 — post-op recovery checklist from clinical.postop_checklist */
export function usePostopChecklist() {
  const { options, loading, error } = useMasterValues('clinical.postop_checklist');
  const items = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_POSTOP_CHECKLIST];
    return options.map((o) => o.label);
  }, [options]);
  return { items, options, loading, error };
}
