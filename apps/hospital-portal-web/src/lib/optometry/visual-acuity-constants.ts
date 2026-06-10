/** Visual Acuity tab subsection IDs (sidebar + scroll anchors). */

export type VaSectionId =
  | 'old'
  | 'new'
  | 'refraction'
  | 'distance'
  | 'keratometry'
  | 'color'
  | 'contrast';

export type VaSectionRecordStatus = 'empty' | 'draft' | 'recorded';

export const VA_SECTIONS: {
  id: VaSectionId;
  label: string;
  anchor: string;
  defaultExpanded: boolean;
  showHistoryPanel: boolean;
}[] = [
  {
    id: 'old',
    label: 'Previous glasses',
    anchor: 'va-section-old',
    defaultExpanded: true,
    showHistoryPanel: true,
  },
  {
    id: 'new',
    label: "Today's Rx",
    anchor: 'va-section-new',
    defaultExpanded: false,
    showHistoryPanel: true,
  },
  {
    id: 'refraction',
    label: 'Refraction',
    anchor: 'va-section-refraction',
    defaultExpanded: false,
    showHistoryPanel: true,
  },
  {
    id: 'distance',
    label: 'Distance & Near',
    anchor: 'va-section-distance',
    defaultExpanded: false,
    showHistoryPanel: true,
  },
  {
    id: 'keratometry',
    label: 'Keratometry',
    anchor: 'va-section-keratometry',
    defaultExpanded: false,
    showHistoryPanel: false,
  },
  {
    id: 'color',
    label: 'Color vision',
    anchor: 'va-section-color',
    defaultExpanded: false,
    showHistoryPanel: false,
  },
  {
    id: 'contrast',
    label: 'Contrast',
    anchor: 'va-section-contrast',
    defaultExpanded: false,
    showHistoryPanel: false,
  },
];

export function vaSectionAnchor(id: VaSectionId): string {
  return VA_SECTIONS.find((s) => s.id === id)?.anchor ?? `va-section-${id}`;
}
