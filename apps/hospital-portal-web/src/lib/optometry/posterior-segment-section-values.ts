import type { PosteriorSectionId } from './posterior-segment-section-constants';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';

function filled(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return v;
  return true;
}

export function posteriorSectionHasValues(
  sectionId: PosteriorSectionId,
  overview: PosteriorSegmentExamData,
  fundus: FundusExamData,
  vitreous: VitreousExamData,
  peripheralRetina: PeripheralRetinaExamData,
): boolean {
  const any = (...vals: unknown[]) => vals.some(filled);

  switch (sectionId) {
    case 'dilation':
      return any(
        overview.isDilatedOD,
        overview.isDilatedOS,
        overview.dilationDrug,
        overview.dilationTime,
      );
    case 'overview':
      return any(overview.mediaClarityOD, overview.mediaClarityOS, overview.overallFindingOD, overview.overallFindingOS);
    case 'disc':
      return any(
        fundus.cupDiscRatioOD,
        fundus.cupDiscRatioOS,
        fundus.discColorOD,
        fundus.discColorOS,
        fundus.discMarginsOD,
        fundus.discMarginsOS,
        fundus.discNvOD,
        fundus.discNvOS,
        fundus.discHemorrhageOD,
        fundus.discHemorrhageOS,
        fundus.peripapillaryAtrophyOD,
        fundus.peripapillaryAtrophyOS,
        fundus.discNotesOD,
        fundus.discNotesOS,
      );
    case 'macula':
      return any(
        fundus.fovealReflexOD,
        fundus.fovealReflexOS,
        fundus.macularEdemaOD,
        fundus.macularEdemaOS,
        fundus.macularHemorrhageOD,
        fundus.macularHemorrhageOS,
        fundus.macularExudatesOD,
        fundus.macularExudatesOS,
        fundus.drusenOD,
        fundus.drusenOS,
        fundus.macularScarOD,
        fundus.macularScarOS,
        fundus.maculaNotesOD,
        fundus.maculaNotesOS,
      );
    case 'retina':
      return any(
        fundus.retinaConfigOD,
        fundus.retinaConfigOS,
        fundus.retinalTearsOD,
        fundus.retinalTearsOS,
        fundus.retinalHemorrhageOD,
        fundus.retinalHemorrhageOS,
        fundus.retinalExudatesOD,
        fundus.retinalExudatesOS,
        fundus.diabeticRetinopathyOD,
        fundus.diabeticRetinopathyOS,
        fundus.peripheralDegenerationOD,
        fundus.peripheralDegenerationOS,
        fundus.retinaNotesOD,
        fundus.retinaNotesOS,
      );
    case 'vessels':
      return any(
        fundus.avRatioOD,
        fundus.avRatioOS,
        fundus.arterialChangesOD,
        fundus.arterialChangesOS,
        fundus.venousChangesOD,
        fundus.venousChangesOS,
        fundus.avCrossingOD,
        fundus.avCrossingOS,
        fundus.vesselNvOD,
        fundus.vesselNvOS,
        fundus.vesselNotesOD,
        fundus.vesselNotesOS,
      );
    case 'vitreous':
      return any(
        vitreous.clarityOD,
        vitreous.clarityOS,
        vitreous.cellsOD,
        vitreous.cellsOS,
        vitreous.hemorrhageOD,
        vitreous.hemorrhageOS,
        vitreous.pvdOD,
        vitreous.pvdOS,
        vitreous.vitritisOD,
        vitreous.vitritisOS,
        vitreous.asteroidHyalosisOD,
        vitreous.asteroidHyalosisOS,
        vitreous.syneresisOD,
        vitreous.syneresisOS,
        vitreous.vitreousNotesOD,
        vitreous.vitreousNotesOS,
      );
    case 'peripheral-retina':
      return any(
        peripheralRetina.peripheralAppearanceOD,
        peripheralRetina.peripheralAppearanceOS,
        peripheralRetina.peripheralBreaksOD,
        peripheralRetina.peripheralBreaksOS,
        peripheralRetina.latticeDegenerationOD,
        peripheralRetina.latticeDegenerationOS,
        peripheralRetina.horseshoeTearOD,
        peripheralRetina.horseshoeTearOS,
        peripheralRetina.retinoschisisOD,
        peripheralRetina.retinoschisisOS,
        peripheralRetina.chorioretinalScarsOD,
        peripheralRetina.chorioretinalScarsOS,
        peripheralRetina.pigmentChangesOD,
        peripheralRetina.pigmentChangesOS,
        peripheralRetina.laserScarsOD,
        peripheralRetina.laserScarsOS,
        peripheralRetina.viewExtentOD,
        peripheralRetina.viewExtentOS,
        peripheralRetina.peripheralRetinaNotesOD,
        peripheralRetina.peripheralRetinaNotesOS,
      );
    default:
      return false;
  }
}
