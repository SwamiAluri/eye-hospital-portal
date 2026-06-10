import type { PaymentMode } from '@/lib/api/opd-billing.api';
import type { MasterOption } from '@/hooks/use-master-values';

/** Map master billing.payment_mode code → OPD API PaymentMode */
const MASTER_TO_API: Record<string, PaymentMode> = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  NEFT: 'net_banking',
  RTGS: 'net_banking',
  ONLINE: 'net_banking',
  CHEQUE: 'cheque',
  INSURANCE: 'insurance',
  DD: 'cheque',
  CREDIT: 'wallet',
};

export function paymentModeCodeToApi(code: string): PaymentMode | null {
  return MASTER_TO_API[code.toUpperCase()] ?? null;
}

export function paymentModeApiToCode(apiMode: PaymentMode, options: MasterOption[]): string | null {
  const match = options.find((o) => paymentModeCodeToApi(o.value) === apiMode);
  return match?.value ?? null;
}

export interface PaymentModeChoice {
  masterCode: string;
  label: string;
  apiMode: PaymentMode;
}

export function paymentModeChoicesFromMaster(options: MasterOption[]): PaymentModeChoice[] {
  const choices: PaymentModeChoice[] = [];
  for (const o of options) {
    const apiMode = paymentModeCodeToApi(o.value);
    if (apiMode) choices.push({ masterCode: o.value, label: o.label, apiMode });
  }
  return choices;
}

/** Fallback when master data is empty (OPD check-in). */
export const FALLBACK_PAYMENT_MODES: PaymentModeChoice[] = [
  { masterCode: 'CASH', label: 'Cash', apiMode: 'cash' },
  { masterCode: 'CARD', label: 'Card', apiMode: 'card' },
  { masterCode: 'UPI', label: 'UPI', apiMode: 'upi' },
  { masterCode: 'NEFT', label: 'Bank', apiMode: 'net_banking' },
];
