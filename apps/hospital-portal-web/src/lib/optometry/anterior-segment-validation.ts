import type { PupilExamData } from './anterior-segment-types';

export function validatePupilExamRequired(pupil: PupilExamData): string | null {
  if (pupil.sizeLightOD == null || pupil.sizeLightOS == null) {
    return 'Pupil size in light (OD & OS) is required.';
  }
  if (pupil.sizeDarkOD == null || pupil.sizeDarkOS == null) {
    return 'Pupil size in dark (OD & OS) is required.';
  }
  if (!pupil.shapeOD || !pupil.shapeOS) {
    return 'Pupil shape (OD & OS) is required.';
  }
  if (!pupil.directReactionOD || !pupil.directReactionOS) {
    return 'Direct light reaction (OD & OS) is required.';
  }
  if (!pupil.consensualReactionOD || !pupil.consensualReactionOS) {
    return 'Consensual reaction (OD & OS) is required.';
  }
  if (pupil.rapdPresent && !pupil.rapdEye) {
    return 'Select which eye has RAPD when RAPD is present.';
  }
  return null;
}

export function anteriorTabHasAnyData(
  pupil: PupilExamData,
  segment: Record<string, unknown>,
): boolean {
  const hasPupil = Object.entries(pupil).some(([k, v]) => {
    if (k === 'rapdPresent') return v === true;
    if (k === 'rapdEye') return v != null;
    return v !== undefined && v !== null && v !== '';
  });
  const hasSeg = Object.values(segment).some(
    (v) => v !== undefined && v !== null && v !== '',
  );
  return hasPupil || hasSeg;
}
