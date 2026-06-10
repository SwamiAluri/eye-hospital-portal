import {
  EMPTY_SPECTACLE_DRAFT,
  normalizeSpectacleDraft,
} from './optometry-persistence';

/** Default form shells applied when no visit segment row exists. */
export const DEFAULT_WET_RETINOSCOPY = {
  drug: undefined,
  duration: undefined,
  timeAdministered: undefined,
  odReadings: [],
  osReadings: [],
};

export const DEFAULT_DRY_RETINOSCOPY = { odReadings: [], osReadings: [] };

export const DEFAULT_SUBJECTIVE_REFRACTION = { readings: [] };

export const DEFAULT_PUPIL_EXAM = {
  sizeLightOD: undefined,
  sizeDarkOD: undefined,
  shapeOD: undefined,
  directReactionOD: undefined,
  consensualReactionOD: undefined,
  sizeLightOS: undefined,
  sizeDarkOS: undefined,
  shapeOS: undefined,
  directReactionOS: undefined,
  consensualReactionOS: undefined,
  rapdPresent: false,
  rapdEye: null,
};

export const DEFAULT_ANTERIOR_SEGMENT = {
  lidsOD: undefined,
  conjunctivaOD: undefined,
  scleraOD: undefined,
  lacrimalOD: undefined,
  lidsOS: undefined,
  conjunctivaOS: undefined,
  scleraOS: undefined,
  lacrimalOS: undefined,
  corneaOD: undefined,
  acOD: undefined,
  acDepthOD: undefined,
  corneaOS: undefined,
  acOS: undefined,
  acDepthOS: undefined,
  irisOD: undefined,
  lensOD: undefined,
  lensOpacityGradeOD: undefined,
  irisOS: undefined,
  lensOS: undefined,
  lensOpacityGradeOS: undefined,
};

export const DEFAULT_POSTERIOR_SEGMENT = {
  mediaClarityOD: undefined,
  isDilatedOD: false,
  dilationDrug: undefined,
  dilationTime: undefined,
  overallFindingOD: undefined,
  mediaClarityOS: undefined,
  isDilatedOS: false,
  overallFindingOS: undefined,
};

export const DEFAULT_VITREOUS_EXAM = {
  clarityOD: undefined,
  clarityOS: undefined,
  cellsOD: undefined,
  cellsOS: undefined,
  hemorrhageOD: undefined,
  hemorrhageOS: undefined,
  pvdOD: undefined,
  pvdOS: undefined,
  vitritisOD: undefined,
  vitritisOS: undefined,
  asteroidHyalosisOD: undefined,
  asteroidHyalosisOS: undefined,
  syneresisOD: undefined,
  syneresisOS: undefined,
  vitreousNotesOD: undefined,
  vitreousNotesOS: undefined,
};

export const DEFAULT_PERIPHERAL_RETINA_EXAM = {
  peripheralAppearanceOD: undefined,
  peripheralAppearanceOS: undefined,
  peripheralBreaksOD: undefined,
  peripheralBreaksOS: undefined,
  latticeDegenerationOD: undefined,
  latticeDegenerationOS: undefined,
  horseshoeTearOD: undefined,
  horseshoeTearOS: undefined,
  retinoschisisOD: undefined,
  retinoschisisOS: undefined,
  chorioretinalScarsOD: undefined,
  chorioretinalScarsOS: undefined,
  pigmentChangesOD: undefined,
  pigmentChangesOS: undefined,
  laserScarsOD: undefined,
  laserScarsOS: undefined,
  viewExtentOD: undefined,
  viewExtentOS: undefined,
  peripheralRetinaNotesOD: undefined,
  peripheralRetinaNotesOS: undefined,
};

export const DEFAULT_FUNDUS_EXAM = {
  cupDiscRatioOD: undefined,
  discColorOD: undefined,
  discMarginsOD: undefined,
  discNvOD: undefined,
  discHemorrhageOD: undefined,
  peripapillaryAtrophyOD: undefined,
  discNotesOD: undefined,
  cupDiscRatioOS: undefined,
  discColorOS: undefined,
  discMarginsOS: undefined,
  discNvOS: undefined,
  discHemorrhageOS: undefined,
  peripapillaryAtrophyOS: undefined,
  discNotesOS: undefined,
  fovealReflexOD: undefined,
  macularEdemaOD: undefined,
  macularHemorrhageOD: undefined,
  macularExudatesOD: undefined,
  drusenOD: undefined,
  macularScarOD: undefined,
  maculaNotesOD: undefined,
  fovealReflexOS: undefined,
  macularEdemaOS: undefined,
  macularHemorrhageOS: undefined,
  macularExudatesOS: undefined,
  drusenOS: undefined,
  macularScarOS: undefined,
  maculaNotesOS: undefined,
  retinaConfigOD: undefined,
  retinalTearsOD: undefined,
  retinalHemorrhageOD: undefined,
  retinalExudatesOD: undefined,
  diabeticRetinopathyOD: undefined,
  peripheralDegenerationOD: undefined,
  retinaNotesOD: undefined,
  retinaConfigOS: undefined,
  retinalTearsOS: undefined,
  retinalHemorrhageOS: undefined,
  retinalExudatesOS: undefined,
  diabeticRetinopathyOS: undefined,
  peripheralDegenerationOS: undefined,
  retinaNotesOS: undefined,
  avRatioOD: undefined,
  arterialChangesOD: [],
  venousChangesOD: [],
  avCrossingOD: undefined,
  vesselNvOD: undefined,
  vesselNotesOD: undefined,
  avRatioOS: undefined,
  arterialChangesOS: [],
  venousChangesOS: [],
  avCrossingOS: undefined,
  vesselNvOS: undefined,
  vesselNotesOS: undefined,
};

export const DEFAULT_CL_ASSESSMENT = { isCurrentWearer: false, examReasons: [] };

export const DEFAULT_CL_INSTRUCTIONS = { precautions: [], trialDispensed: false };

export const DEFAULT_ADVICE_FOLLOW_UP = {
  nextVisitDate: '',
  followUpReason: '',
  testsNeeded: [],
  reminderPreferences: [],
};

export const DEFAULT_ADVICE_PRECAUTIONS = {
  conditionSpecific: [],
  customPrecautions: '',
  redFlags: [],
};

export const DEFAULT_ADVICE_EDUCATION = {
  selectedMaterials: [],
  deliveryMethods: [],
  language: 'English',
};

/** Apply empty defaults for every visit-scoped exam tab (before segment/draft overlay). */
export function applyVisitExamDefaults(setters: {
  setWetRetinoscopy: (v: unknown) => void;
  setDryRetinoscopy: (v: unknown) => void;
  setSubjectiveRefraction: (v: unknown) => void;
  setPupilExam: (v: unknown) => void;
  setAnteriorSegment: (v: unknown) => void;
  setPosteriorSegment: (v: unknown) => void;
  setFundusExam: (v: unknown) => void;
  setVitreousExam: (v: unknown) => void;
  setPeripheralRetinaExam: (v: unknown) => void;
  setCurrentMedications: (v: unknown) => void;
  setPrescriptionItems: (v: unknown) => void;
  setClAssessment: (v: unknown) => void;
  setClPrescription: (v: unknown) => void;
  setClFitting: (v: unknown) => void;
  setClCornealHealth: (v: unknown) => void;
  setClInstructions: (v: unknown) => void;
  setSpectacleDispensing: (v: unknown) => void;
  setDoctorReferrals: (v: unknown) => void;
  setImagingOrders: (v: unknown) => void;
  setReceptionReferrals: (v: unknown) => void;
  setDiagnoses: (v: unknown) => void;
  setAdviceInstructions: (v: unknown) => void;
  setAdviceFollowUp: (v: unknown) => void;
  setAdvicePrecautions: (v: unknown) => void;
  setAdviceEducation: (v: unknown) => void;
}): void {
  setters.setWetRetinoscopy(DEFAULT_WET_RETINOSCOPY);
  setters.setDryRetinoscopy(DEFAULT_DRY_RETINOSCOPY);
  setters.setSubjectiveRefraction(DEFAULT_SUBJECTIVE_REFRACTION);
  setters.setPupilExam(DEFAULT_PUPIL_EXAM);
  setters.setAnteriorSegment(DEFAULT_ANTERIOR_SEGMENT);
  setters.setPosteriorSegment(DEFAULT_POSTERIOR_SEGMENT);
  setters.setFundusExam(DEFAULT_FUNDUS_EXAM);
  setters.setVitreousExam(DEFAULT_VITREOUS_EXAM);
  setters.setPeripheralRetinaExam(DEFAULT_PERIPHERAL_RETINA_EXAM);
  setters.setCurrentMedications([]);
  setters.setPrescriptionItems([]);
  setters.setClAssessment(DEFAULT_CL_ASSESSMENT);
  setters.setClPrescription({});
  setters.setClFitting({});
  setters.setClCornealHealth({});
  setters.setClInstructions(DEFAULT_CL_INSTRUCTIONS);
  setters.setSpectacleDispensing(EMPTY_SPECTACLE_DRAFT);
  setters.setDoctorReferrals([]);
  setters.setImagingOrders([]);
  setters.setReceptionReferrals([]);
  setters.setDiagnoses([]);
  setters.setAdviceInstructions([]);
  setters.setAdviceFollowUp(DEFAULT_ADVICE_FOLLOW_UP);
  setters.setAdvicePrecautions(DEFAULT_ADVICE_PRECAUTIONS);
  setters.setAdviceEducation(DEFAULT_ADVICE_EDUCATION);
}

export { normalizeSpectacleDraft, EMPTY_SPECTACLE_DRAFT };
