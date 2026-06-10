import type { PosteriorSectionId } from './posterior-segment-section-constants';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';

export function getPosteriorSectionNormals(sectionId: PosteriorSectionId): Record<string, unknown> {
  switch (sectionId) {
    case 'dilation':
      return {
        isDilatedOD: false,
        isDilatedOS: false,
        dilationDrug: undefined,
        dilationTime: undefined,
      };
    case 'overview':
      return {
        mediaClarityOD: 'Clear',
        mediaClarityOS: 'Clear',
        overallFindingOD: 'Normal',
        overallFindingOS: 'Normal',
      };
    case 'disc':
      return {
        cupDiscRatioOD: '0.3',
        discColorOD: 'Pink',
        discMarginsOD: 'Distinct',
        discNvOD: 'Absent',
        discHemorrhageOD: 'Absent',
        peripapillaryAtrophyOD: 'Absent',
        cupDiscRatioOS: '0.3',
        discColorOS: 'Pink',
        discMarginsOS: 'Distinct',
        discNvOS: 'Absent',
        discHemorrhageOS: 'Absent',
        peripapillaryAtrophyOS: 'Absent',
      };
    case 'macula':
      return {
        fovealReflexOD: 'Present',
        macularEdemaOD: 'Absent',
        macularHemorrhageOD: 'Absent',
        macularExudatesOD: 'Absent',
        drusenOD: 'Absent',
        macularScarOD: 'Absent',
        fovealReflexOS: 'Present',
        macularEdemaOS: 'Absent',
        macularHemorrhageOS: 'Absent',
        macularExudatesOS: 'Absent',
        drusenOS: 'Absent',
        macularScarOS: 'Absent',
      };
    case 'retina':
      return {
        retinaConfigOD: 'Normal/Attached',
        retinalTearsOD: 'Absent',
        retinalHemorrhageOD: 'Absent',
        retinalExudatesOD: 'Absent',
        diabeticRetinopathyOD: 'None',
        peripheralDegenerationOD: 'Absent',
        retinaConfigOS: 'Normal/Attached',
        retinalTearsOS: 'Absent',
        retinalHemorrhageOS: 'Absent',
        retinalExudatesOS: 'Absent',
        diabeticRetinopathyOS: 'None',
        peripheralDegenerationOS: 'Absent',
      };
    case 'vessels':
      return {
        avRatioOD: '2:3',
        arterialChangesOD: [],
        venousChangesOD: [],
        avCrossingOD: 'None',
        vesselNvOD: 'Absent',
        avRatioOS: '2:3',
        arterialChangesOS: [],
        venousChangesOS: [],
        avCrossingOS: 'None',
        vesselNvOS: 'Absent',
      };
    case 'vitreous':
      return {
        clarityOD: 'Clear',
        cellsOD: 'Absent',
        hemorrhageOD: 'Absent',
        pvdOD: 'Absent',
        vitritisOD: 'Absent',
        asteroidHyalosisOD: 'Absent',
        syneresisOD: 'Normal',
        clarityOS: 'Clear',
        cellsOS: 'Absent',
        hemorrhageOS: 'Absent',
        pvdOS: 'Absent',
        vitritisOS: 'Absent',
        asteroidHyalosisOS: 'Absent',
        syneresisOS: 'Normal',
      };
    case 'peripheral-retina':
      return {
        peripheralAppearanceOD: 'Normal',
        peripheralBreaksOD: 'Absent',
        latticeDegenerationOD: 'Absent',
        horseshoeTearOD: 'Absent',
        retinoschisisOD: 'Absent',
        chorioretinalScarsOD: 'Absent',
        pigmentChangesOD: 'Absent',
        laserScarsOD: 'Absent',
        viewExtentOD: 'Fully visible',
        peripheralAppearanceOS: 'Normal',
        peripheralBreaksOS: 'Absent',
        latticeDegenerationOS: 'Absent',
        horseshoeTearOS: 'Absent',
        retinoschisisOS: 'Absent',
        chorioretinalScarsOS: 'Absent',
        pigmentChangesOS: 'Absent',
        laserScarsOS: 'Absent',
        viewExtentOS: 'Fully visible',
      };
    default:
      return {};
  }
}

function applyEyeNormals(
  preset: Record<string, unknown>,
  eye: 'OD' | 'OS' | 'both',
  target: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(preset)) {
    if (eye === 'OD' && key.endsWith('OD')) target[key] = value;
    if (eye === 'OS' && key.endsWith('OS')) target[key] = value;
    if (eye === 'both') target[key] = value;
  }
}

export function applyPosteriorNormalToEye(
  sectionId: PosteriorSectionId,
  eye: 'OD' | 'OS' | 'both',
  overview: PosteriorSegmentExamData,
  fundus: FundusExamData,
  vitreous: VitreousExamData,
  peripheralRetina: PeripheralRetinaExamData,
): {
  overview: PosteriorSegmentExamData;
  fundus: FundusExamData;
  vitreous: VitreousExamData;
  peripheralRetina: PeripheralRetinaExamData;
} {
  const preset = getPosteriorSectionNormals(sectionId);
  const o = { ...overview };
  const f = { ...fundus };
  const v = { ...vitreous };
  const p = { ...peripheralRetina };

  if (sectionId === 'dilation' || sectionId === 'overview') {
    applyEyeNormals(preset, eye === 'both' ? 'both' : eye, o as Record<string, unknown>);
    if (sectionId === 'dilation' && eye === 'both') {
      o.dilationDrug = undefined;
      o.dilationTime = undefined;
    }
  } else if (sectionId === 'vitreous') {
    applyEyeNormals(preset, eye, v as Record<string, unknown>);
  } else if (sectionId === 'peripheral-retina') {
    applyEyeNormals(preset, eye, p as Record<string, unknown>);
  } else {
    applyEyeNormals(preset, eye, f as Record<string, unknown>);
  }

  return { overview: o, fundus: f, vitreous: v, peripheralRetina: p };
}

export function copyPosteriorOdToOsSection(
  sectionId: PosteriorSectionId,
  overview: PosteriorSegmentExamData,
  fundus: FundusExamData,
  vitreous: VitreousExamData,
  peripheralRetina: PeripheralRetinaExamData,
): {
  overview: PosteriorSegmentExamData;
  fundus: FundusExamData;
  vitreous: VitreousExamData;
  peripheralRetina: PeripheralRetinaExamData;
} {
  const copyIn = (obj: Record<string, unknown>, pairs: [string, string][]) => {
    for (const [od, os] of pairs) {
      if (obj[od] !== undefined) obj[os] = obj[od];
    }
  };

  const o = { ...overview } as Record<string, unknown>;
  const f = { ...fundus } as Record<string, unknown>;
  const v = { ...vitreous } as Record<string, unknown>;
  const p = { ...peripheralRetina } as Record<string, unknown>;

  const pairsBySection: Partial<Record<PosteriorSectionId, [string, string][]>> = {
    overview: [
      ['mediaClarityOD', 'mediaClarityOS'],
      ['overallFindingOD', 'overallFindingOS'],
    ],
    disc: [
      ['cupDiscRatioOD', 'cupDiscRatioOS'],
      ['discColorOD', 'discColorOS'],
      ['discMarginsOD', 'discMarginsOS'],
      ['discNvOD', 'discNvOS'],
      ['discHemorrhageOD', 'discHemorrhageOS'],
      ['peripapillaryAtrophyOD', 'peripapillaryAtrophyOS'],
      ['discNotesOD', 'discNotesOS'],
    ],
    macula: [
      ['fovealReflexOD', 'fovealReflexOS'],
      ['macularEdemaOD', 'macularEdemaOS'],
      ['macularHemorrhageOD', 'macularHemorrhageOS'],
      ['macularExudatesOD', 'macularExudatesOS'],
      ['drusenOD', 'drusenOS'],
      ['macularScarOD', 'macularScarOS'],
      ['maculaNotesOD', 'maculaNotesOS'],
    ],
    retina: [
      ['retinaConfigOD', 'retinaConfigOS'],
      ['retinalTearsOD', 'retinalTearsOS'],
      ['retinalHemorrhageOD', 'retinalHemorrhageOS'],
      ['retinalExudatesOD', 'retinalExudatesOS'],
      ['diabeticRetinopathyOD', 'diabeticRetinopathyOS'],
      ['peripheralDegenerationOD', 'peripheralDegenerationOS'],
      ['retinaNotesOD', 'retinaNotesOS'],
    ],
    vessels: [
      ['avRatioOD', 'avRatioOS'],
      ['avCrossingOD', 'avCrossingOS'],
      ['vesselNvOD', 'vesselNvOS'],
      ['vesselNotesOD', 'vesselNotesOS'],
    ],
    vitreous: [
      ['clarityOD', 'clarityOS'],
      ['cellsOD', 'cellsOS'],
      ['hemorrhageOD', 'hemorrhageOS'],
      ['pvdOD', 'pvdOS'],
      ['vitritisOD', 'vitritisOS'],
      ['asteroidHyalosisOD', 'asteroidHyalosisOS'],
      ['syneresisOD', 'syneresisOS'],
      ['vitreousNotesOD', 'vitreousNotesOS'],
    ],
    'peripheral-retina': [
      ['peripheralAppearanceOD', 'peripheralAppearanceOS'],
      ['peripheralBreaksOD', 'peripheralBreaksOS'],
      ['latticeDegenerationOD', 'latticeDegenerationOS'],
      ['horseshoeTearOD', 'horseshoeTearOS'],
      ['retinoschisisOD', 'retinoschisisOS'],
      ['chorioretinalScarsOD', 'chorioretinalScarsOS'],
      ['pigmentChangesOD', 'pigmentChangesOS'],
      ['laserScarsOD', 'laserScarsOS'],
      ['viewExtentOD', 'viewExtentOS'],
      ['peripheralRetinaNotesOD', 'peripheralRetinaNotesOS'],
    ],
  };

  if (sectionId === 'dilation') {
    o.isDilatedOS = o.isDilatedOD;
    if (!o.isDilatedOD) {
      o.dilationDrug = undefined;
      o.dilationTime = undefined;
    }
    return {
      overview: o as PosteriorSegmentExamData,
      fundus: f as FundusExamData,
      vitreous: v as VitreousExamData,
      peripheralRetina: p as PeripheralRetinaExamData,
    };
  }

  const pairs = pairsBySection[sectionId];
  if (!pairs) {
    return {
      overview: o as PosteriorSegmentExamData,
      fundus: f as FundusExamData,
      vitreous: v as VitreousExamData,
      peripheralRetina: p as PeripheralRetinaExamData,
    };
  }

  if (sectionId === 'overview') copyIn(o, pairs);
  else if (sectionId === 'vitreous') copyIn(v, pairs);
  else if (sectionId === 'peripheral-retina') copyIn(p, pairs);
  else {
    copyIn(f, pairs);
    if (sectionId === 'vessels') {
      f.arterialChangesOS = [...((f.arterialChangesOD as string[]) || [])];
      f.venousChangesOS = [...((f.venousChangesOD as string[]) || [])];
    }
  }

  return {
    overview: o as PosteriorSegmentExamData,
    fundus: f as FundusExamData,
    vitreous: v as VitreousExamData,
    peripheralRetina: p as PeripheralRetinaExamData,
  };
}
