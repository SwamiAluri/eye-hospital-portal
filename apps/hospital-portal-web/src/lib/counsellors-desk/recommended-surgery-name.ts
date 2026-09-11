import type { SurgeryOption } from '@/types/counsellors-desk';

/** Recommended procedure label from session surgeries (SurgeryOption.surgeryName). */
export function recommendedSurgeryName(
  surgeries: SurgeryOption[] | null | undefined,
): string | null {
  const rec = (surgeries ?? []).find((s) => s.isRecommended);
  const name = rec?.surgeryName?.trim();
  return name || null;
}
