import type { MasterOption } from '@/hooks/use-master-values';

/** Fallback counsellor.patient_intention rows (API codes from counseling-sessions.api). */
export const DEFAULT_PATIENT_INTENTION: MasterOption[] = [
  { value: 'WillingNow', label: 'Ready Now — Schedule Today', metadata: { category: 'willing' } },
  { value: 'WillingWeek', label: 'Within 1 Week', metadata: { category: 'willing' } },
  { value: 'WillingTwoWeeks', label: 'Within 2 Weeks', metadata: { category: 'willing' } },
  { value: 'WillingMonth', label: 'Within 1 Month', metadata: { category: 'willing' } },
  { value: 'WillingQuarter', label: 'Within 3 Months', metadata: { category: 'willing' } },
  { value: 'WillingSixMonths', label: 'After 6 Months', metadata: { category: 'willing' } },
  { value: 'WillingCallToConfirm', label: 'Will Call to Confirm', metadata: { category: 'willing' } },
  { value: 'Undecided', label: 'Undecided', metadata: { category: 'not_ready' } },
  { value: 'WaitingFinancial', label: 'Financial Hold', metadata: { category: 'not_ready' } },
  { value: 'WaitingFear', label: 'Fear / Hesitant', metadata: { category: 'not_ready' } },
  { value: 'SecondOpinion', label: 'Second Opinion', metadata: { category: 'not_ready' } },
  { value: 'Declined', label: 'Declined Surgery', metadata: { category: 'not_ready' } },
  { value: 'ReferredElsewhere', label: 'Referred Elsewhere', metadata: { category: 'not_ready' } },
];

export function resolvePatientIntentionOptions(master: MasterOption[]): MasterOption[] {
  return master.length > 0 ? master : DEFAULT_PATIENT_INTENTION;
}

export function isWillingIntention(value: string | undefined, options: MasterOption[]): boolean {
  if (!value) return false;
  const match = options.find((o) => o.value === value);
  return match?.metadata?.category === 'willing';
}
