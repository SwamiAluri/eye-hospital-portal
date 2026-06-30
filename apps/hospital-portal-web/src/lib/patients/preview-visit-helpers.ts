/** Infer OD / OS / OU laterality label from visit reason or procedure text. */
const LATERALITY_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(ou|both eyes)\b/i, label: 'OU' },
  { pattern: /\b(od|right eye|re)\b/i, label: 'OD' },
  { pattern: /\b(os|left eye|le)\b/i, label: 'OS' },
];

export function inferVisitLaterality(
  reason?: string | null,
  procedureName?: string | null,
): string | null {
  const text = `${reason ?? ''} ${procedureName ?? ''}`.trim();
  if (!text) return null;

  for (const { pattern, label } of LATERALITY_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}
