'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

const FALLBACK_DEPARTMENTS = [
  { value: 'ADMISSIONS', label: 'Admissions' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'LAB', label: 'Laboratory' },
  { value: 'OT', label: 'Operation Theatre' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'NURSING', label: 'Nursing' },
] as const;

const FALLBACK_CHECKLIST_ITEMS = [
  'Consent Form Signed',
  'ID Verified',
  'Allergies Checked',
  'Vitals Recorded',
  'Payment Cleared',
] as const;

/** B6 — department types from system.department */
export function useDepartmentMaster() {
  const { options, loading, error } = useMasterValues('system.department');
  const departments = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_DEPARTMENTS];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { departments, options, loading, error };
}

/** B6 — default checklist items from system.checklist_default */
export function useChecklistDefaults() {
  const { options, loading, error } = useMasterValues('system.checklist_default');
  const items = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_CHECKLIST_ITEMS];
    return options.map((o) => o.label);
  }, [options]);
  return { items, options, loading, error };
}
