'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  FALLBACK_PAYMENT_MODES,
  paymentModeChoicesFromMaster,
  type PaymentModeChoice,
} from '@/lib/billing/payment-mode-maps';

/** B3 — OPD / billing payment modes from master billing.payment_mode */
export function usePaymentModes() {
  const { options, loading, error } = useMasterValues('billing.payment_mode');

  const modes = useMemo<PaymentModeChoice[]>(() => {
    const fromMaster = paymentModeChoicesFromMaster(options);
    return fromMaster.length > 0 ? fromMaster : FALLBACK_PAYMENT_MODES;
  }, [options]);

  return {
    modes,
    loading,
    error,
    options,
  };
}

const INVENTORY_PAYMENT_FALLBACK = ['Cash', 'Credit', 'UPI', 'NEFT', 'RTGS', 'Cheque'] as const;

/** Inventory modules that store payment mode as display label (GRN/pharmacy/PO). */
export function useInventoryPaymentModeLabels() {
  const { options, loading, error } = useMasterValues('billing.payment_mode');
  const labels = useMemo(() => {
    if (options.length === 0) return [...INVENTORY_PAYMENT_FALLBACK];
    return options.map((o) => o.label);
  }, [options]);
  return { labels, loading, error };
}
