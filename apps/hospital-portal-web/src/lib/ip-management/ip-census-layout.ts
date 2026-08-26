/** Docked split: list + context rail. Matches architecture IP-001 / S-01. */
export const CENSUS_DOCKED_MIN_PX = 1280;
/** Sheet (dim overlay, no blur) between tablet and desktop. */
export const CENSUS_SHEET_MIN_PX = 1024;
/** S-02 rail: wide enough for identity + blockers + payments without wrapping. */
export const CENSUS_RAIL_WIDTH_PX = 520;

export type CensusPresentation = 'docked' | 'sheet' | 'cards';

export function censusPresentationForWidth(width: number): CensusPresentation {
  if (width >= CENSUS_DOCKED_MIN_PX) return 'docked';
  if (width >= CENSUS_SHEET_MIN_PX) return 'sheet';
  return 'cards';
}

export interface CensusColumn {
  key: string;
  label: string;
  /**
   * Why this column exists on the census. Kept here so list and rail
   * do not drift from the S-01 workflow (who / where / next / blocked).
   */
  purpose: string;
}

/**
 * Census answers: who is here, where are they, what is blocking them, what happens next.
 * Opening the rail must not hide columns. Admission time and OT state stay on the list
 * (confirmed) as well as in the rail.
 */
export const CENSUS_COLUMNS: readonly CensusColumn[] = [
  { key: 'clinical', label: 'State', purpose: 'Clinical machine — scan the floor by stage' },
  { key: 'patient', label: 'Patient', purpose: 'Identity (name, UHID, age) — wrong-patient prevention' },
  { key: 'procedure', label: 'Procedure', purpose: 'What is booked and which eye' },
  { key: 'ward', label: 'Ward / bed', purpose: 'Physical location on the ward' },
  { key: 'slot', label: 'Slot', purpose: 'OT sequence for today (AM-3) — unassigned if none' },
  { key: 'admitted', label: 'Admitted', purpose: 'How long they have been in-house' },
  { key: 'ot', label: 'OT state', purpose: 'OT machine, distinct from clinical state' },
  { key: 'next', label: 'Next action', purpose: 'Single next step and which desk owns it' },
  { key: 'attention', label: 'Attention', purpose: 'Financial + coverage + operational blockers' },
];

/** Always the full set — opening the rail must not shed columns. */
export function censusColumnsVisible(_compact = false): CensusColumn[] {
  return [...CENSUS_COLUMNS];
}
