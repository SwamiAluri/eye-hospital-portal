export type AnteriorSectionId = 'pupil' | 'external' | 'cornea-ac' | 'iris-lens';

export const ANTERIOR_SECTIONS: {
  id: AnteriorSectionId;
  label: string;
  shortLabel: string;
  anchor: string;
  defaultExpanded: boolean;
}[] = [
  {
    id: 'pupil',
    label: 'Pupil examination',
    shortLabel: 'Pupil',
    anchor: 'as-section-pupil',
    defaultExpanded: true,
  },
  {
    id: 'external',
    label: 'External eye & adnexa',
    shortLabel: 'External',
    anchor: 'as-section-external',
    defaultExpanded: false,
  },
  {
    id: 'cornea-ac',
    label: 'Cornea & anterior chamber',
    shortLabel: 'Cornea',
    anchor: 'as-section-cornea-ac',
    defaultExpanded: false,
  },
  {
    id: 'iris-lens',
    label: 'Iris & lens',
    shortLabel: 'Iris/Lens',
    anchor: 'as-section-iris-lens',
    defaultExpanded: false,
  },
];
