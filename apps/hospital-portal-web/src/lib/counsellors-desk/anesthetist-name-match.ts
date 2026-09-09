/** Staff anaesthetist option from GET /users/anesthetists (UI + match helpers). */
export interface AnesthetistOption {
  id: string;
  name: string;
  employeeId?: string;
  jobTitle?: string;
  specialization?: string;
}

export type AnesthetistUiMode = 'list' | 'other';

/** Normalize display names for duplicate comparison (staff list only). */
export function normalizeAnesthetistName(name?: string | null): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Match manually entered names against existing staff anaesthetists only. */
export function findAnesthetistsByDisplayName(
  name: string | null | undefined,
  staff: AnesthetistOption[],
): AnesthetistOption[] {
  const key = normalizeAnesthetistName(name);
  if (!key) return [];
  return staff.filter((a) => normalizeAnesthetistName(a.name) === key);
}

/**
 * Resolve list vs Other on load from saved anesthetistName.
 * Matching staff → list (never silently leave as Other).
 */
export function resolveAnesthetistUiMode(
  savedName: string | null | undefined,
  staff: AnesthetistOption[],
): { mode: AnesthetistUiMode; selectedId: string | null } {
  const trimmed = (savedName ?? '').trim();
  if (!trimmed) return { mode: 'list', selectedId: null };

  const matches = findAnesthetistsByDisplayName(trimmed, staff);
  if (matches.length > 0) {
    return { mode: 'list', selectedId: matches[0]!.id };
  }
  return { mode: 'other', selectedId: null };
}

/** True when Other mode still has an unresolved staff name collision. */
export function hasUnresolvedAnesthetistNameConflict(
  mode: AnesthetistUiMode,
  manualName: string | null | undefined,
  staff: AnesthetistOption[],
): boolean {
  if (mode !== 'other') return false;
  return findAnesthetistsByDisplayName(manualName, staff).length > 0;
}

/** Secondary line for distinguishing same-name staff in the UI. */
export function formatAnesthetistDistinguisher(a: AnesthetistOption): string {
  const parts = [a.employeeId, a.jobTitle, a.specialization]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return parts.join(' · ');
}
