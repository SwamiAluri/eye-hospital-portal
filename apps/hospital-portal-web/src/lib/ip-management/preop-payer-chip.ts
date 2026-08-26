/**
 * Pre-op header "Payer:" chip. Payment mode only — never financialState
 * (NotCreated / Draft / Paid are ledger states, not payers).
 */
export function preOpPayerChipLabel(paymentMode: string | null | undefined): string {
  const mode = (paymentMode ?? '').trim();
  if (!mode) return 'Self-pay';
  const key = mode.toLowerCase().replace(/[\s_-]/g, '');
  if (key === 'cash' || key === 'selfpay') return 'Self-pay';
  return mode;
}
