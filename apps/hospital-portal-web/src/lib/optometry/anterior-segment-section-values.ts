import type { AnteriorSectionId } from './anterior-segment-section-constants';
import type { AnteriorSegmentExamData, PupilExamData } from './anterior-segment-types';

function filled(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (typeof v === 'boolean') return v;
  return true;
}

const PUPIL_KEYS: (keyof PupilExamData)[] = [
  'sizeLightOD',
  'sizeLightOS',
  'sizeDarkOD',
  'sizeDarkOS',
  'shapeOD',
  'shapeOS',
  'directReactionOD',
  'directReactionOS',
  'consensualReactionOD',
  'consensualReactionOS',
  'rapdEye',
];

const EXTERNAL_KEYS: (keyof AnteriorSegmentExamData)[] = [
  'lidsOD',
  'lidsOS',
  'conjunctivaOD',
  'conjunctivaOS',
  'scleraOD',
  'scleraOS',
  'lacrimalOD',
  'lacrimalOS',
];

const CORNEA_AC_KEYS: (keyof AnteriorSegmentExamData)[] = [
  'corneaOD',
  'corneaOS',
  'acOD',
  'acOS',
  'acDepthOD',
  'acDepthOS',
];

const IRIS_LENS_KEYS: (keyof AnteriorSegmentExamData)[] = [
  'irisOD',
  'irisOS',
  'lensOD',
  'lensOS',
  'lensOpacityGradeOD',
  'lensOpacityGradeOS',
];

export function anteriorSectionHasValues(
  sectionId: AnteriorSectionId,
  pupil: PupilExamData,
  segment: AnteriorSegmentExamData,
): boolean {
  switch (sectionId) {
    case 'pupil':
      return PUPIL_KEYS.some((k) => filled(pupil[k])) || pupil.rapdPresent;
    case 'external':
      return EXTERNAL_KEYS.some((k) => filled(segment[k]));
    case 'cornea-ac':
      return CORNEA_AC_KEYS.some((k) => filled(segment[k]));
    case 'iris-lens':
      return IRIS_LENS_KEYS.some((k) => filled(segment[k]));
    default:
      return false;
  }
}
