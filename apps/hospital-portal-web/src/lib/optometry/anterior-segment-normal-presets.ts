import type { AnteriorSectionId } from './anterior-segment-section-constants';
import type { AnteriorSegmentExamData, PupilExamData } from './anterior-segment-types';

export function getAnteriorSectionNormalPupil(): Partial<PupilExamData> {
  return {
    sizeLightOD: 3,
    sizeDarkOD: 5,
    shapeOD: 'Round',
    directReactionOD: 'Brisk',
    consensualReactionOD: 'Brisk',
    sizeLightOS: 3,
    sizeDarkOS: 5,
    shapeOS: 'Round',
    directReactionOS: 'Brisk',
    consensualReactionOS: 'Brisk',
    rapdPresent: false,
    rapdEye: null,
  };
}

export function getAnteriorSectionNormalSegment(
  sectionId: Exclude<AnteriorSectionId, 'pupil'>,
): Partial<AnteriorSegmentExamData> {
  switch (sectionId) {
    case 'external':
      return {
        lidsOD: 'Normal',
        conjunctivaOD: 'Normal',
        scleraOD: 'Normal',
        lacrimalOD: 'Normal',
        lidsOS: 'Normal',
        conjunctivaOS: 'Normal',
        scleraOS: 'Normal',
        lacrimalOS: 'Normal',
      };
    case 'cornea-ac':
      return {
        corneaOD: 'Clear',
        acOD: 'Normal Depth',
        acDepthOD: 'Grade 4/Wide',
        corneaOS: 'Clear',
        acOS: 'Normal Depth',
        acDepthOS: 'Grade 4/Wide',
      };
    case 'iris-lens':
      return {
        irisOD: 'Normal',
        lensOD: 'Clear',
        lensOpacityGradeOD: undefined,
        irisOS: 'Normal',
        lensOS: 'Clear',
        lensOpacityGradeOS: undefined,
      };
    default:
      return {};
  }
}

export function applyAnteriorNormalToEye(
  sectionId: AnteriorSectionId,
  eye: 'OD' | 'OS' | 'both',
  pupil: PupilExamData,
  segment: AnteriorSegmentExamData,
): { pupil: PupilExamData; segment: AnteriorSegmentExamData } {
  if (sectionId === 'pupil') {
    const preset = getAnteriorSectionNormalPupil();
    if (eye === 'OD' || eye === 'both') {
      Object.assign(pupil, {
        sizeLightOD: preset.sizeLightOD,
        sizeDarkOD: preset.sizeDarkOD,
        shapeOD: preset.shapeOD,
        directReactionOD: preset.directReactionOD,
        consensualReactionOD: preset.consensualReactionOD,
      });
    }
    if (eye === 'OS' || eye === 'both') {
      Object.assign(pupil, {
        sizeLightOS: preset.sizeLightOS,
        sizeDarkOS: preset.sizeDarkOS,
        shapeOS: preset.shapeOS,
        directReactionOS: preset.directReactionOS,
        consensualReactionOS: preset.consensualReactionOS,
      });
    }
    if (eye === 'both') {
      pupil.rapdPresent = false;
      pupil.rapdEye = null;
    }
    return { pupil: { ...pupil }, segment: { ...segment } };
  }

  const preset = getAnteriorSectionNormalSegment(sectionId);
  const next = { ...segment };
  for (const [key, value] of Object.entries(preset)) {
    if (eye === 'OD' && key.endsWith('OD')) (next as Record<string, unknown>)[key] = value;
    if (eye === 'OS' && key.endsWith('OS')) (next as Record<string, unknown>)[key] = value;
    if (eye === 'both') (next as Record<string, unknown>)[key] = value;
  }
  return { pupil: { ...pupil }, segment: next };
}

export function copyAnteriorOdToOsSection(
  sectionId: AnteriorSectionId,
  pupil: PupilExamData,
  segment: AnteriorSegmentExamData,
): { pupil: PupilExamData; segment: AnteriorSegmentExamData } {
  const nextPupil = { ...pupil };
  const nextSeg = { ...segment };

  const copyPair = (odKey: string, osKey: string, obj: Record<string, unknown>) => {
    if (obj[odKey] !== undefined) obj[osKey] = obj[odKey];
  };

  if (sectionId === 'pupil') {
    copyPair('sizeLightOD', 'sizeLightOS', nextPupil as Record<string, unknown>);
    copyPair('sizeDarkOD', 'sizeDarkOS', nextPupil as Record<string, unknown>);
    copyPair('shapeOD', 'shapeOS', nextPupil as Record<string, unknown>);
    copyPair('directReactionOD', 'directReactionOS', nextPupil as Record<string, unknown>);
    copyPair('consensualReactionOD', 'consensualReactionOS', nextPupil as Record<string, unknown>);
    return { pupil: nextPupil, segment: nextSeg };
  }

  const fieldsBySection: Record<Exclude<AnteriorSectionId, 'pupil'>, [string, string][]> = {
    external: [
      ['lidsOD', 'lidsOS'],
      ['conjunctivaOD', 'conjunctivaOS'],
      ['scleraOD', 'scleraOS'],
      ['lacrimalOD', 'lacrimalOS'],
    ],
    'cornea-ac': [
      ['corneaOD', 'corneaOS'],
      ['acOD', 'acOS'],
      ['acDepthOD', 'acDepthOS'],
    ],
    'iris-lens': [
      ['irisOD', 'irisOS'],
      ['lensOD', 'lensOS'],
      ['lensOpacityGradeOD', 'lensOpacityGradeOS'],
    ],
  };

  for (const [od, os] of fieldsBySection[sectionId]) {
    copyPair(od, os, nextSeg as Record<string, unknown>);
  }
  return { pupil: nextPupil, segment: nextSeg };
}
