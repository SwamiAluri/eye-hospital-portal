export type PosteriorSectionId =
  | 'dilation'
  | 'overview'
  | 'disc'
  | 'macula'
  | 'retina'
  | 'vessels'
  | 'vitreous'
  | 'peripheral-retina';

export const POSTERIOR_SECTIONS: {
  id: PosteriorSectionId;
  label: string;
  shortLabel: string;
  anchor: string;
  defaultExpanded: boolean;
}[] = [
  {
    id: 'dilation',
    label: 'Dilatation',
    shortLabel: 'Dilation',
    anchor: 'ps-section-dilation',
    defaultExpanded: true,
  },
  {
    id: 'overview',
    label: 'Fundus overview',
    shortLabel: 'Overview',
    anchor: 'ps-section-overview',
    defaultExpanded: false,
  },
  {
    id: 'disc',
    label: 'Optic disc',
    shortLabel: 'Disc',
    anchor: 'ps-section-disc',
    defaultExpanded: false,
  },
  {
    id: 'macula',
    label: 'Macula',
    shortLabel: 'Macula',
    anchor: 'ps-section-macula',
    defaultExpanded: false,
  },
  {
    id: 'retina',
    label: 'Retina',
    shortLabel: 'Retina',
    anchor: 'ps-section-retina',
    defaultExpanded: false,
  },
  {
    id: 'vessels',
    label: 'Retinal vessels',
    shortLabel: 'Vessels',
    anchor: 'ps-section-vessels',
    defaultExpanded: false,
  },
  {
    id: 'vitreous',
    label: 'Vitreous',
    shortLabel: 'Vitreous',
    anchor: 'ps-section-vitreous',
    defaultExpanded: false,
  },
  {
    id: 'peripheral-retina',
    label: 'Peripheral retina',
    shortLabel: 'Periph.',
    anchor: 'ps-section-peripheral-retina',
    defaultExpanded: false,
  },
];

export const ARTERIAL_CHANGE_OPTIONS = ['Narrowing', 'Tortuosity', 'Sheathing', 'Occlusion'] as const;
export const VENOUS_CHANGE_OPTIONS = ['Dilation', 'Tortuosity', 'Beading', 'Occlusion'] as const;
