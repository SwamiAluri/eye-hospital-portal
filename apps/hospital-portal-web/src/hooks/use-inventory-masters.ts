'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

const CATEGORY_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-red-100 text-red-700',
  'bg-cyan-100 text-cyan-700',
  'bg-amber-100 text-amber-700',
  'bg-orange-100 text-orange-700',
  'bg-gray-100 text-gray-600',
] as const;

const FALLBACK_VENDOR_CATEGORIES = [
  { value: 'pharmaceutical', label: 'Pharma', color: CATEGORY_COLORS[0] },
  { value: 'iol_optical', label: 'IOL / Optical', color: CATEGORY_COLORS[1] },
  { value: 'surgical', label: 'Surgical', color: CATEGORY_COLORS[2] },
  { value: 'cold_chain', label: 'Cold Chain', color: CATEGORY_COLORS[3] },
  { value: 'general_supplies', label: 'General Supplies', color: CATEGORY_COLORS[4] },
  { value: 'general', label: 'General', color: CATEGORY_COLORS[6] },
] as const;

const FALLBACK_STORAGE_CONDITIONS = [
  'Room Temperature (15-25°C)',
  'Cool (8-15°C)',
  'Refrigerate (2-8°C)',
  'Freeze (-20°C)',
  'Dry Place',
  'Dark / Light-Protected',
] as const;

const FALLBACK_PAYMENT_TERMS = [
  'Immediate (0 days)',
  'Net 15 days',
  'Net 30 days',
  'Net 45 days',
  'Net 60 days',
  'Net 90 days',
] as const;

const COLD_STORAGE_CODES = new Set(['COOL', 'REFRIGERATE', 'FREEZE']);

/** B6 — vendor categories from inventory.vendor_category */
export function useVendorCategories() {
  const { options, loading, error } = useMasterValues('inventory.vendor_category');
  const categories = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_VENDOR_CATEGORIES];
    return options.map((o, i) => ({
      value: o.value,
      label: o.label,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [options]);
  return { categories, loading, error };
}

export function vendorCategoryMeta(
  value: string,
  categories: Array<{ value: string; label: string; color: string }>,
) {
  return (
    categories.find((c) => c.value === value) ??
    FALLBACK_VENDOR_CATEGORIES.find((c) => c.value === value) ?? {
      value,
      label: value,
      color: CATEGORY_COLORS[6],
    }
  );
}

/** B6 — storage conditions from inventory.storage_condition */
export function useStorageConditions() {
  const { options, loading, error } = useMasterValues('inventory.storage_condition');
  const choices = useMemo(() => {
    if (options.length === 0) {
      return FALLBACK_STORAGE_CONDITIONS.map((label) => ({ value: label, label }));
    }
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { choices, options, loading, error };
}

export function requiresColdStorageFromCode(code: string): boolean {
  return COLD_STORAGE_CODES.has(code.toUpperCase());
}

/** B6 — PO/GRN payment terms from inventory.payment_term */
export function usePaymentTerms() {
  const { options, loading, error } = useMasterValues('inventory.payment_term');
  const terms = useMemo(() => {
    if (options.length === 0) {
      return FALLBACK_PAYMENT_TERMS.map((label) => ({ value: label, label }));
    }
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { terms, options, loading, error };
}

/** Parse credit days from payment term label (e.g. "Net 30 days" → 30). */
export function creditDaysFromPaymentTermLabel(label: string): number | undefined {
  const match = label.match(/(\d+)\s*days?/i);
  if (match) return Number(match[1]);
  if (/immediate/i.test(label)) return 0;
  return undefined;
}
