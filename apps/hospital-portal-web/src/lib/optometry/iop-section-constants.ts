/** IOP tab subsection IDs (sidebar + scroll anchors). */

export type IopSectionId = 'nct' | 'atn' | 'schirmer' | 'pachymetry' | 'visual-field';

export type IopSectionRecordStatus = 'empty' | 'draft' | 'recorded';

/** Sections expected on a typical visit (ATN is optional). */
export const IOP_REQUIRED_SECTIONS: IopSectionId[] = [
  'nct',
  'schirmer',
  'pachymetry',
  'visual-field',
];

export const IOP_SECTIONS: {
  id: IopSectionId;
  label: string;
  shortLabel: string;
  anchor: string;
  defaultExpanded: boolean;
  showHistoryPanel: boolean;
}[] = [
  {
    id: 'nct',
    label: 'Non-Contact Tonometry (NCT)',
    shortLabel: 'NCT',
    anchor: 'iop-section-nct',
    defaultExpanded: true,
    showHistoryPanel: true,
  },
  {
    id: 'atn',
    label: 'Applanation Tonometry (ATN)',
    shortLabel: 'ATN',
    anchor: 'iop-section-atn',
    defaultExpanded: false,
    showHistoryPanel: true,
  },
  {
    id: 'schirmer',
    label: 'Schirmer Tear Test',
    shortLabel: 'Schirmer',
    anchor: 'iop-section-schirmer',
    defaultExpanded: true,
    showHistoryPanel: true,
  },
  {
    id: 'pachymetry',
    label: 'Pachymetry',
    shortLabel: 'Pachymetry',
    anchor: 'iop-section-pachymetry',
    defaultExpanded: false,
    showHistoryPanel: true,
  },
  {
    id: 'visual-field',
    label: 'Visual Field Test',
    shortLabel: 'Visual Field',
    anchor: 'iop-section-visual-field',
    defaultExpanded: false,
    showHistoryPanel: true,
  },
];

export function iopSectionAnchor(id: IopSectionId): string {
  return IOP_SECTIONS.find((s) => s.id === id)?.anchor ?? `iop-section-${id}`;
}
