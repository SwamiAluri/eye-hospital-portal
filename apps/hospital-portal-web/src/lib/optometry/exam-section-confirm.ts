/** Confirm before overwriting section values with normal presets. */
export function confirmMarkAllNormal(sectionTitle: string, hasExistingValues: boolean): boolean {
  if (!hasExistingValues) return true;
  return window.confirm(
    `${sectionTitle} already has recorded values. Replace with normal values for the selected eye(s)?`,
  );
}
