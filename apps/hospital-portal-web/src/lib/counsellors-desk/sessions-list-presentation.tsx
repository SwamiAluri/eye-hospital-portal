/**
 * CGX-1 Sessions list presentation.
 * Uses list-payload fields only. Does not derive HealthId or relabel MRN as UHID.
 */

import { cn } from '@/lib/utils';

/** Readable title-case column header. Not 10px uppercase. */
export const cgx1WorklistHeaderClass =
  'text-sm font-semibold leading-5 tracking-normal text-counselling-foreground';

export function nonEmptyListText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Matches existing StatusBadge labels. Unknown values stay the API string. */
const SESSION_STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Scheduled',
  InProgress: 'In Progress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  NoShow: 'NoShow',
};

export function formatSessionListStatus(status: string | null | undefined): string | null {
  const value = nonEmptyListText(status);
  if (!value) return null;
  return SESSION_STATUS_LABELS[value] ?? value;
}

/** Null CounselorId is Unassigned. A name is shown only when the row already has an owner id. */
export function sessionsOwnerLabel(
  counselorId: string | null | undefined,
  counselorName: string | null | undefined,
): string {
  if (!counselorId) return 'Unassigned';
  return nonEmptyListText(counselorName) ?? 'Assigned';
}

export function SessionsMrnLine({ mrn }: { mrn: string | null | undefined }) {
  const value = nonEmptyListText(mrn);
  if (!value) return null;
  return (
    <p
      data-testid="sessions-row-mrn"
      className="mt-0.5 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground"
    >
      <span className="font-semibold text-counselling-foreground">MRN</span>
      {': '}
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

export function SessionsEyeLine({ eye }: { eye: string | null | undefined }) {
  const value = nonEmptyListText(eye);
  if (!value) return null;
  return (
    <p
      data-testid="sessions-row-eye"
      className="mt-0.5 truncate text-xs leading-4 text-counselling-muted-foreground"
    >
      <span className="font-medium text-counselling-foreground">Eye</span>
      {': '}
      <span>{value}</span>
    </p>
  );
}

export function sessionsHeaderClassName(align: 'left' | 'right' = 'left') {
  return cn(
    'px-2.5 py-1.5 sm:px-3',
    cgx1WorklistHeaderClass,
    align === 'right' ? 'text-right' : 'text-left',
  );
}
