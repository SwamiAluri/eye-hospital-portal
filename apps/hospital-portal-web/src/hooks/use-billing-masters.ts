'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

const FALLBACK_BILL_ITEM_TYPES = [
  { value: 'CONSULTATION', label: 'Consultation Fee' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'DIAGNOSTIC', label: 'Diagnostic Test' },
  { value: 'MISC', label: 'Miscellaneous' },
] as const;

const FALLBACK_TRANSACTION_TYPES = [
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'REFUND', label: 'Refund' },
] as const;

/** B3 — bill line item categories from billing.bill_item_type */
export function useBillItemTypes() {
  const { options, loading, error } = useMasterValues('billing.bill_item_type');

  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_BILL_ITEM_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);

  return { types, loading, error, options };
}

/** B3 — payment/advance/refund classification from billing.transaction_type */
export function useTransactionTypes() {
  const { options, loading, error } = useMasterValues('billing.transaction_type');

  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_TRANSACTION_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);

  return { types, loading, error, options };
}
