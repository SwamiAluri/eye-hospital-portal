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
 * Large-desktop (≥1600) track contract —
 * Patient | Visit | Procedure | Owner | Payment / Coverage | Status | Action.
 * Workstation fluid tracks (768–1599.98) live only in `counselling-session-theme.css`.
 * Action track sized for single-line Re-evaluate / Start Repeat CTAs.
 */
export const WAITING_LIST_WORK_GRID_TRACKS =
  'minmax(10rem, 1.2fr) minmax(6.25rem, 0.85fr) minmax(7.25rem, 0.95fr) minmax(5.25rem, 0.7fr) minmax(5.75rem, 0.8fr) minmax(4.75rem, 6.25rem) minmax(9.5rem, 11rem)';

export const WAITING_LIST_OT_GRID_TRACKS =
  'minmax(12rem, 1.35fr) minmax(9rem, 1fr) minmax(9rem, 1.1fr) minmax(6.5rem, 0.7fr) minmax(8.5rem, 10rem)';

/** Workstation fluid tracks (768–1599.98) — seven-zone Patient Queue IA. */
export const WAITING_LIST_WORK_GRID_TRACKS_WORKSTATION =
  'minmax(0, 1.2fr) minmax(0, 0.85fr) minmax(0, 0.95fr) minmax(0, 0.7fr) minmax(0, 0.8fr) minmax(4.5rem, 6rem) minmax(8.75rem, 10.25rem)';
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
