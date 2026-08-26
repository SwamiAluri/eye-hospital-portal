export type ChargeStatusCode = 'complete' | 'missing_charges' | 'unmapped';

export function chargeStatusBadgeClass(status: string | null | undefined): string {
  if (status === 'unmapped') return 'bg-red-50 text-red-800 border-red-200';
  if (status === 'missing_charges') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-teal-50 text-teal-800 border-teal-200';
}
