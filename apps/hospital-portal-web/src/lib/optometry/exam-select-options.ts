/** Merge canonical options with legacy stored values so old visits still display in lists. */
export function mergeSelectOptions(canonical: readonly string[], ...legacyValues: (string | undefined)[]): string[] {
  const set = new Set<string>(canonical);
  for (const v of legacyValues) {
    if (v && v.trim()) set.add(v);
  }
  return [...set];
}
