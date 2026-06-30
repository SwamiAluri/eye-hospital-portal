import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import { completionByKey } from '@/lib/ip-management/clinical-evaluation';

const SITE_MARKED_KEY = 'surgery_site_marked';

/** Normalize counselling / journey operative eye to OD | OS | OU. */
export function normalizeOperativeEye(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'OD' || raw === 'OS' || raw === 'OU') return raw;
  if (raw === 'RE' || raw.includes('RIGHT')) return 'OD';
  if (raw === 'LE' || raw.includes('LEFT')) return 'OS';
  if (raw === 'BOTH' || raw.includes('BILAT')) return 'OU';
  return raw;
}

/**
 * Laterality hard-stop (Phase 6): site marked, marked-by captured, and attested eye
 * matches the scheduled operative eye on the journey header.
 */
export function isLateralityAttested(
  completions: PreOpCompletionDto[],
  scheduledEye: string | null | undefined,
): boolean {
  const scheduled = normalizeOperativeEye(scheduledEye);
  if (!scheduled) return false;

  const row = completionByKey(completions, SITE_MARKED_KEY);
  if (!row?.isCompleted && !row?.isBypassed) return false;
  if (!row.notes?.trim()) return false;

  const attested = normalizeOperativeEye(row.resultValue);
  return attested === scheduled;
}

export function lateralityBlockMessage(scheduledEye: string | null | undefined): string {
  const eye = normalizeOperativeEye(scheduledEye);
  if (!eye) return 'Operative eye is not scheduled on this journey.';
  return `Surgery site for ${eye} must be marked and attested in Consent & Authorization.`;
}
