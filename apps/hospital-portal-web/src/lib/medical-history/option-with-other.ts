export const OTHER_OPTION = 'Other';

/** Map stored value to select key + optional custom text when not in the preset list. */
export function splitOptionWithOther(
  value: string,
  options: readonly string[],
): { selectValue: string; customText: string } {
  if (!value) return { selectValue: '', customText: '' };
  if (options.includes(value as (typeof options)[number])) {
    return { selectValue: value, customText: '' };
  }
  return { selectValue: OTHER_OPTION, customText: value };
}

/** Resolve select key + custom text to the value persisted on the record. */
export function resolveOptionWithOther(selectValue: string, customText: string): string {
  if (selectValue === OTHER_OPTION) return customText.trim();
  return selectValue;
}
