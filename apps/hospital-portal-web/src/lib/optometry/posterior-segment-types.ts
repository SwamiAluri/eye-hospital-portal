/** Posterior segment examination payloads (visit segments). */

export interface PosteriorSegmentExamData {
  mediaClarityOD?: string;
  isDilatedOD?: boolean;
  dilationDrug?: string;
  dilationTime?: string;
  overallFindingOD?: string;
  mediaClarityOS?: string;
  isDilatedOS?: boolean;
  overallFindingOS?: string;
}

export interface FundusExamData {
  cupDiscRatioOD?: string;
  discColorOD?: string;
  discMarginsOD?: string;
  discNvOD?: string;
  discHemorrhageOD?: string;
  peripapillaryAtrophyOD?: string;
  discNotesOD?: string;
  cupDiscRatioOS?: string;
  discColorOS?: string;
  discMarginsOS?: string;
  discNvOS?: string;
  discHemorrhageOS?: string;
  peripapillaryAtrophyOS?: string;
  discNotesOS?: string;
  fovealReflexOD?: string;
  macularEdemaOD?: string;
  macularHemorrhageOD?: string;
  macularExudatesOD?: string;
  drusenOD?: string;
  macularScarOD?: string;
  maculaNotesOD?: string;
  fovealReflexOS?: string;
  macularEdemaOS?: string;
  macularHemorrhageOS?: string;
  macularExudatesOS?: string;
  drusenOS?: string;
  macularScarOS?: string;
  maculaNotesOS?: string;
  retinaConfigOD?: string;
  retinalTearsOD?: string;
  retinalHemorrhageOD?: string;
  retinalExudatesOD?: string;
  diabeticRetinopathyOD?: string;
  peripheralDegenerationOD?: string;
  retinaNotesOD?: string;
  retinaConfigOS?: string;
  retinalTearsOS?: string;
  retinalHemorrhageOS?: string;
  retinalExudatesOS?: string;
  diabeticRetinopathyOS?: string;
  peripheralDegenerationOS?: string;
  retinaNotesOS?: string;
  avRatioOD?: string;
  arterialChangesOD?: string[];
  venousChangesOD?: string[];
  avCrossingOD?: string;
  vesselNvOD?: string;
  vesselNotesOD?: string;
  avRatioOS?: string;
  arterialChangesOS?: string[];
  venousChangesOS?: string[];
  avCrossingOS?: string;
  vesselNvOS?: string;
  vesselNotesOS?: string;
}

export interface VitreousExamData {
  clarityOD?: string;
  clarityOS?: string;
  cellsOD?: string;
  cellsOS?: string;
  hemorrhageOD?: string;
  hemorrhageOS?: string;
  pvdOD?: string;
  pvdOS?: string;
  vitritisOD?: string;
  vitritisOS?: string;
  asteroidHyalosisOD?: string;
  asteroidHyalosisOS?: string;
  syneresisOD?: string;
  syneresisOS?: string;
  vitreousNotesOD?: string;
  vitreousNotesOS?: string;
}

export interface PeripheralRetinaExamData {
  peripheralAppearanceOD?: string;
  peripheralAppearanceOS?: string;
  peripheralBreaksOD?: string;
  peripheralBreaksOS?: string;
  latticeDegenerationOD?: string;
  latticeDegenerationOS?: string;
  horseshoeTearOD?: string;
  horseshoeTearOS?: string;
  retinoschisisOD?: string;
  retinoschisisOS?: string;
  chorioretinalScarsOD?: string;
  chorioretinalScarsOS?: string;
  pigmentChangesOD?: string;
  pigmentChangesOS?: string;
  laserScarsOD?: string;
  laserScarsOS?: string;
  viewExtentOD?: string;
  viewExtentOS?: string;
  peripheralRetinaNotesOD?: string;
  peripheralRetinaNotesOS?: string;
}

export interface PosteriorTabSavePayload {
  overview: PosteriorSegmentExamData;
  fundus: FundusExamData;
  vitreous: VitreousExamData;
  peripheralRetina: PeripheralRetinaExamData;
}
