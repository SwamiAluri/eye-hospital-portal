/**
 * Shared Waiting List worklist column alignment (header + rows).
 *
 * Class names map to real CSS in `counselling-session-theme.css` under
 * `.counselling-session`. Do not replace these with Tailwind `grid-cols-[…]`
 * string constants living only in `src/lib` — that path is outside Tailwind
 * `content`, so JIT never emits the five-column tracks (browser UAT Task 7R).
 */
export const WAITING_LIST_WORK_GRID = 'waiting-list-work-grid';

export const WAITING_LIST_OT_GRID = 'waiting-list-ot-grid';

/** Desktop track contract (documentation + tests; SoT is theme CSS). */
export const WAITING_LIST_WORK_GRID_TRACKS =
  'minmax(14rem, 1.6fr) minmax(10rem, 1.2fr) minmax(7rem, 8.5rem) minmax(7rem, 0.85fr) minmax(9.5rem, 11rem)';

export const WAITING_LIST_OT_GRID_TRACKS =
  'minmax(12rem, 1.35fr) minmax(9rem, 1fr) minmax(9rem, 1.1fr) minmax(6.5rem, 0.7fr) minmax(8.5rem, 10rem)';

/** Display-only: collapse repeated Dr. prefixes without changing stored data. */
export function formatWaitingListDoctorDisplay(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  return value.replace(/^(?:Dr\.?\s*)+/i, 'Dr. ').trim();
}
