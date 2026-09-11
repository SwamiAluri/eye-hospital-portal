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

/**
 * Large-desktop (≥1600) track contract — approved Large Desktop SoT.
 * Workstation fluid tracks (768–1599.98) live only in `counselling-session-theme.css`.
 */
export const WAITING_LIST_WORK_GRID_TRACKS =
  'minmax(14rem, 1.6fr) minmax(10rem, 1.2fr) minmax(7rem, 8.5rem) minmax(7rem, 0.85fr) minmax(9.5rem, 11rem)';

export const WAITING_LIST_OT_GRID_TRACKS =
  'minmax(12rem, 1.35fr) minmax(9rem, 1fr) minmax(9rem, 1.1fr) minmax(6.5rem, 0.7fr) minmax(8.5rem, 10rem)';

/** Workstation fluid tracks (768–1599.98) — same five-zone IA, flexible mins. */
export const WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION =
  'minmax(0, 1.65fr) minmax(0, 1.2fr) minmax(5.25rem, 7.25rem) minmax(0, 0.8fr) minmax(7rem, 9.25rem)';

/** @deprecated Use WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION — kept for test aliases. */
export const WAITING_LIST_WORK_GRID_TRACKS_COMPRESSED =
  WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION;

/** @deprecated Intermediate laptop band removed; workstation is continuous <1600. */
export const WAITING_LIST_WORK_GRID_TRACKS_LAPTOP =
  WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION;

/** Display-only: collapse repeated Dr. prefixes without changing stored data. */
export function formatWaitingListDoctorDisplay(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  return value.replace(/^(?:Dr\.?\s*)+/i, 'Dr. ').trim();
}
