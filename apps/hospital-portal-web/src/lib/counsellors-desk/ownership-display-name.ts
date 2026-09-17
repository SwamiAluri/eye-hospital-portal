import type { CounselingCounselorOption } from '@/lib/api/counsellors-desk.api';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AssignCounsellorListState =
  | 'loading'
  | 'error'
  | 'empty'
  | 'no-match'
  | 'ready';

export function counselorOptionLabel(c: CounselingCounselorOption): string {
  return (
    c.name?.trim() ||
    `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
    c.email?.trim() ||
    c.id
  );
}

export function buildCounselorNameMap(
  counselors: CounselingCounselorOption[],
  session?: { counselorId?: string | null; counselorName?: string | null } | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of counselors) {
    if (!c.id) continue;
    const label = counselorOptionLabel(c);
    if (label) map[c.id] = label;
  }
  const sid = session?.counselorId?.trim();
  const sname = session?.counselorName?.trim();
  if (sid && sname && !map[sid]) {
    map[sid] = sname;
  }
  return map;
}

/** Ownership From/To party display — never invent clinical data. */
export function formatOwnershipParty(
  value: string | null | undefined,
  nameById: Record<string, string>,
): string {
  if (value == null || String(value).trim() === '') return 'Unassigned';
  const raw = String(value).trim();
  const mapped = nameById[raw];
  if (mapped?.trim()) return mapped.trim();
  if (UUID_RE.test(raw)) return 'Unknown user';
  // Already a display name (legacy/fixture strings)
  return raw;
}

export function filterCounselorsByQuery(
  counselors: CounselingCounselorOption[],
  query: string,
): CounselingCounselorOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return counselors;
  return counselors.filter((c) => {
    const hay = [c.name, c.firstName, c.lastName, c.email, c.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function formatEligibleCounsellorCount(count: number): string {
  return count === 1
    ? '1 eligible counsellor'
    : `${count} eligible counsellors`;
}

export function resolveAssignCounsellorListState(input: {
  loading: boolean;
  error: string | null;
  eligibleCount: number;
  filteredCount: number;
  query: string;
}): AssignCounsellorListState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.eligibleCount === 0) return 'empty';
  if (input.query.trim() && input.filteredCount === 0) return 'no-match';
  return 'ready';
}
