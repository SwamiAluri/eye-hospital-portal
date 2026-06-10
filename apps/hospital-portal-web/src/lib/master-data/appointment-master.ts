import type { MasterOption } from '@/hooks/use-master-values';

/** Resolve a stored appointment field value to a master label (falls back to raw value). */
export function masterLabelForValue(options: MasterOption[], value?: string | null): string {
  if (!value) return '';
  const key = value.trim().toLowerCase();
  const match = options.find(
    (o) => o.value.toLowerCase() === key || o.label.toLowerCase() === key,
  );
  return match?.label ?? value;
}

/** Default code when master list is available (first item or fallback). */
export function defaultMasterCode(options: MasterOption[], fallback = ''): string {
  return options[0]?.value ?? fallback;
}
