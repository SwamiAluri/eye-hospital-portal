/** Retinoscopy tab subsection IDs (sidebar + scroll anchors). */

export type RetinoscopySectionId = 'wet' | 'dry' | 'subjective';

export type RetinoscopySectionRecordStatus = 'empty' | 'draft' | 'recorded';

export type RetinoscopySectionViewMode = 'view' | 'editing';

/** All retinoscopy subsections are required on every visit (unlike optional IOP ATN). */
export const RETINOSCOPY_REQUIRED_SECTIONS: RetinoscopySectionId[] = [
  'wet',
  'dry',
  'subjective',
];

export const RETINOSCOPY_SECTIONS: {
  id: RetinoscopySectionId;
  label: string;
  shortLabel: string;
  anchor: string;
  defaultExpanded: boolean;
  showHistoryPanel: boolean;
  required: boolean;
}[] = [
  {
    id: 'wet',
    label: 'Wet Retinoscopy (cycloplegic)',
    shortLabel: 'Wet',
    anchor: 'retinoscopy-section-wet',
    defaultExpanded: true,
    showHistoryPanel: true,
    required: true,
  },
  {
    id: 'dry',
    label: 'Dry Retinoscopy',
    shortLabel: 'Dry',
    anchor: 'retinoscopy-section-dry',
    defaultExpanded: false,
    showHistoryPanel: true,
    required: true,
  },
  {
    id: 'subjective',
    label: 'Subjective Refraction',
    shortLabel: 'Subjective',
    anchor: 'retinoscopy-section-subjective',
    defaultExpanded: false,
    showHistoryPanel: true,
    required: true,
  },
];

export function isRetinoscopyTabFullyRecorded(
  sectionRecorded: Partial<Record<RetinoscopySectionId, boolean>>,
): boolean {
  return RETINOSCOPY_REQUIRED_SECTIONS.every((id) => sectionRecorded[id] === true);
}

export function retinoscopySectionAnchor(id: RetinoscopySectionId): string {
  return RETINOSCOPY_SECTIONS.find((s) => s.id === id)?.anchor ?? `retinoscopy-section-${id}`;
}
