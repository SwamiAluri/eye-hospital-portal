import type { MasterOption } from '@/hooks/use-master-values';

/** B8.4 — prefer master metadata.isEyeRelevant; fall back to legacy label sets. */
export function isEyeRelevantLabel(
  label: string,
  options: readonly MasterOption[],
  fallback: ReadonlySet<string>,
): boolean {
  const match = options.find((o) => o.label === label);
  if (match?.metadata && typeof match.metadata.isEyeRelevant === 'boolean') {
    return match.metadata.isEyeRelevant;
  }
  return fallback.has(label);
}
