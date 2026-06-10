export const MEDIA_CLARITY_OPTIONS = ['Clear', 'Hazy', 'Opaque'];

export const OVERALL_FINDING_OPTIONS = ['Normal', 'Abnormal - specify below'];

export const DILATION_DRUG_OPTIONS = [
  'Tropicamide 1%',
  'Phenylephrine 2.5%',
  'Combination',
];

export const CUP_DISC_RATIO_OPTIONS = [
  '0.1',
  '0.2',
  '0.3',
  '0.4',
  '0.5',
  '0.6',
  '0.7',
  '0.8',
  '0.9',
];

export const DISC_COLOR_OPTIONS = ['Pink', 'Pale', 'Hyperemic', 'Atrophic'];

export const DISC_MARGINS_OPTIONS = ['Distinct', 'Blurred', 'Indistinct'];

export const ABSENT_PRESENT = ['Absent', 'Present'];

export const FOVEAL_REFLEX_OPTIONS = ['Present', 'Absent', 'Diminished'];

export const MACULAR_EDEMA_OPTIONS = ['Absent', 'Mild', 'Moderate', 'Severe'];

export const DRUSEN_OPTIONS = [
  'Absent',
  'Hard',
  'Soft',
  'Confluent',
  /** Legacy stored values */
  'Soft (Cotton-wool)',
];

export const DRUSEN_OPTIONS_CANONICAL = ['Absent', 'Hard', 'Soft', 'Confluent'] as const;

export const RETINA_CONFIG_OPTIONS = ['Normal/Attached', 'Detached', 'Thinning'];

export const RETINAL_HEMORRHAGE_OPTIONS = ['Absent', 'Dot & Blot', 'Flame-shaped', 'Preretinal'];

export const RETINAL_EXUDATES_OPTIONS = ['Absent', 'Hard', 'Soft'];

export const DIABETIC_RETINOPATHY_OPTIONS = [
  'None',
  'Mild NPDR',
  'Moderate NPDR',
  'Severe NPDR',
  'PDR',
  /** Legacy stored values */
  'PDR (Proliferative)',
  'PDR (Proliferative DR)',
];

export const PERIPHERAL_DEGENERATION_OPTIONS = ['Absent', 'Lattice', 'Paving Stone', 'Other'];

export const AV_RATIO_OPTIONS = ['2:3', '1:2', '1:3', '1:1'];

export const AV_CROSSING_OPTIONS = ['None', 'Mild', 'Moderate', 'Severe'];

export {
  VITREOUS_CLARITY_OPTIONS,
  VITREOUS_CELLS_OPTIONS,
  VITREOUS_PVD_OPTIONS,
  VITREOUS_SYNERESIS_OPTIONS,
} from './posterior-segment/vitreous-form-options';

export { PERIPHERAL_APPEARANCE_OPTIONS, VIEW_EXTENT_OPTIONS } from './posterior-segment/peripheral-retina-form-options';
