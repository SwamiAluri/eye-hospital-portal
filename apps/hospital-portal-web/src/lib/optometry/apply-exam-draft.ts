import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import type { OptometryExamDraftData } from './optometry-exam-types';
import { OPTOMETRY_SEGMENT_KEYS } from './optometry-segment-keys';
import type {
  AutoRefractionData,
  ColorVisionData,
  ContrastSensitivityData,
  KeratometryData,
  PachymetryData,
  RefractionData,
  RetinoscopyData,
  TonometryData,
  VisualAcuityData,
  VisualFieldData,
} from '@/lib/stores/clinical-store';

export type ExamDraftHydrationKey =
  | 'visualAcuity'
  | 'refraction'
  | 'autoRefraction'
  | 'keratometry'
  | 'colorVision'
  | 'contrastSensitivity'
  | 'tonometry'
  | 'pachymetry'
  | 'visualField'
  | 'vaExtended'
  | 'iopExtended'
  | 'retinoscopy'
  | 'wetRetinoscopy'
  | 'dryRetinoscopy'
  | 'subjectiveRefraction'
  | 'pupilExam'
  | 'anteriorSegment'
  | 'posteriorSegment'
  | 'fundusExam'
  | 'vitreousExam'
  | 'peripheralRetinaExam'
  | 'currentMedications'
  | 'prescriptionItems'
  | 'clAssessment'
  | 'clPrescription'
  | 'clFitting'
  | 'clCornealHealth'
  | 'clInstructions'
  | 'spectacleDispensing'
  | 'doctorReferrals'
  | 'imagingOrders'
  | 'receptionReferrals'
  | 'diagnoses'
  | 'adviceInstructions'
  | 'adviceFollowUp'
  | 'advicePrecautions'
  | 'adviceEducation';

export interface ExamDraftSetters {
  setVisualAcuity: (v: VisualAcuityData | null) => void;
  setRefraction: (v: RefractionData | null) => void;
  setAutoRefraction: (v: AutoRefractionData | null) => void;
  setKeratometry: (v: KeratometryData | null) => void;
  setColorVision: (v: ColorVisionData | null) => void;
  setContrastSensitivity: (v: ContrastSensitivityData | null) => void;
  setTonometry: (v: TonometryData | null) => void;
  setPachymetry: (v: PachymetryData | null) => void;
  setVisualField: (v: VisualFieldData | null) => void;
  setVaExtended: (v: unknown) => void;
  setIopExtended: (v: unknown) => void;
  setRetinoscopy: (v: RetinoscopyData | null) => void;
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
  /** Called when the draft includes a medical history snapshot (for exam MH hydration). */
  onMedicalHistorySnapshot?: (snapshot: MedicalHistorySnapshot | null) => void;
}

export interface ApplyExamDraftOptions {
  /** Draft keys to skip — segment rows already hydrated these fields. */
  skipKeys?: ReadonlySet<ExamDraftHydrationKey>;
  /** When true, do not apply draft medicalHistorySnapshot (segment is canonical). */
  skipMedicalHistory?: boolean;
}

export interface ApplyExamDraftResult {
  hydrated: Set<ExamDraftHydrationKey>;
  medicalHistorySnapshot: MedicalHistorySnapshot | null;
}

/** Map loaded visit segment keys to draft hydration keys that must not overwrite segments. */
export function segmentKeysToDraftSkipKeys(
  loadedSegmentKeys: ReadonlySet<string>,
): Set<ExamDraftHydrationKey> {
  const skip = new Set<ExamDraftHydrationKey>();

  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.visualAcuityBundle)) {
    skip.add('vaExtended');
    skip.add('visualAcuity');
    skip.add('refraction');
    skip.add('keratometry');
    skip.add('colorVision');
    skip.add('contrastSensitivity');
  }

  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.iopBundle)) {
    skip.add('iopExtended');
    skip.add('tonometry');
    skip.add('pachymetry');
    skip.add('visualField');
  }

  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.wetRetinoscopy)) {
    skip.add('wetRetinoscopy');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.dryRetinoscopy)) {
    skip.add('dryRetinoscopy');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.subjectiveRefraction)) {
    skip.add('subjectiveRefraction');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.pupilExam)) {
    skip.add('pupilExam');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.anteriorSegment)) {
    skip.add('anteriorSegment');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.posteriorSegment)) {
    skip.add('posteriorSegment');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.fundusExam)) {
    skip.add('fundusExam');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.vitreousExam)) {
    skip.add('vitreousExam');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam)) {
    skip.add('peripheralRetinaExam');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.prescriptionItems)) {
    skip.add('prescriptionItems');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.opticalBundle)) {
    skip.add('clAssessment');
    skip.add('clPrescription');
    skip.add('clFitting');
    skip.add('clCornealHealth');
    skip.add('clInstructions');
    skip.add('spectacleDispensing');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.doctorReferrals)) {
    skip.add('doctorReferrals');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.imagingOrders)) {
    skip.add('imagingOrders');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.receptionReferrals)) {
    skip.add('receptionReferrals');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.diagnoses)) {
    skip.add('diagnoses');
  }
  if (loadedSegmentKeys.has(OPTOMETRY_SEGMENT_KEYS.adviceBundle)) {
    skip.add('adviceInstructions');
    skip.add('adviceFollowUp');
    skip.add('advicePrecautions');
    skip.add('adviceEducation');
  }

  return skip;
}

/** Applies a visit draft to exam page state (fallback for keys with no segment row). */
export function applyExamDraft(
  draft: OptometryExamDraftData,
  setters: ExamDraftSetters,
  options: ApplyExamDraftOptions = {},
): ApplyExamDraftResult {
  const hydrated = new Set<ExamDraftHydrationKey>();
  const skipKeys = options.skipKeys ?? new Set<ExamDraftHydrationKey>();

  const apply = <K extends ExamDraftHydrationKey>(
    key: K,
    value: unknown,
    setter: (v: never) => void,
  ) => {
    if (skipKeys.has(key)) return;
    if (value === undefined || value === null) return;
    setter(value as never);
    hydrated.add(key);
  };

  apply('visualAcuity', draft.visualAcuityData, setters.setVisualAcuity);
  apply('refraction', draft.refractionData, setters.setRefraction);
  apply('autoRefraction', draft.autoRefractionData, setters.setAutoRefraction);
  apply('keratometry', draft.keratometryData, setters.setKeratometry);
  apply('colorVision', draft.colorVisionData, setters.setColorVision);
  apply('contrastSensitivity', draft.contrastSensitivityData, setters.setContrastSensitivity);
  apply('tonometry', draft.tonometryData, setters.setTonometry);
  apply('pachymetry', draft.pachymetryData, setters.setPachymetry);
  apply('visualField', draft.visualFieldData, setters.setVisualField);
  apply('vaExtended', draft.vaExtended, setters.setVaExtended);
  apply('iopExtended', draft.iopExtended, setters.setIopExtended);
  apply('retinoscopy', draft.retinoscopyData, setters.setRetinoscopy);
  apply('wetRetinoscopy', draft.wetRetinoscopy, setters.setWetRetinoscopy);
  apply('dryRetinoscopy', draft.dryRetinoscopy, setters.setDryRetinoscopy);
  apply('subjectiveRefraction', draft.subjectiveRefraction, setters.setSubjectiveRefraction);
  apply('pupilExam', draft.pupilExam, setters.setPupilExam);
  apply('anteriorSegment', draft.anteriorSegment, setters.setAnteriorSegment);
  apply('posteriorSegment', draft.posteriorSegment, setters.setPosteriorSegment);
  apply('fundusExam', draft.fundusExam, setters.setFundusExam);
  apply('vitreousExam', draft.vitreousExam, setters.setVitreousExam);
  apply('peripheralRetinaExam', draft.peripheralRetinaExam, setters.setPeripheralRetinaExam);
  apply('currentMedications', draft.currentMedications, setters.setCurrentMedications);
  apply('prescriptionItems', draft.prescriptionItems, setters.setPrescriptionItems);
  apply('clAssessment', draft.clAssessment, setters.setClAssessment);
  apply('clPrescription', draft.clPrescription, setters.setClPrescription);
  apply('clFitting', draft.clFitting, setters.setClFitting);
  apply('clCornealHealth', draft.clCornealHealth, setters.setClCornealHealth);
  apply('clInstructions', draft.clInstructions, setters.setClInstructions);
  apply('spectacleDispensing', draft.spectacleDispensing, setters.setSpectacleDispensing);
  apply('doctorReferrals', draft.doctorReferrals, setters.setDoctorReferrals);
  apply('imagingOrders', draft.imagingOrders, setters.setImagingOrders);
  apply('receptionReferrals', draft.receptionReferrals, setters.setReceptionReferrals);
  apply('diagnoses', draft.diagnoses, setters.setDiagnoses);
  apply('adviceInstructions', draft.adviceInstructions, setters.setAdviceInstructions);
  apply('adviceFollowUp', draft.adviceFollowUp, setters.setAdviceFollowUp);
  apply('advicePrecautions', draft.advicePrecautions, setters.setAdvicePrecautions);
  apply('adviceEducation', draft.adviceEducation, setters.setAdviceEducation);

  const medicalHistorySnapshot =
    !options.skipMedicalHistory && draft.medicalHistorySnapshot
      ? (draft.medicalHistorySnapshot as MedicalHistorySnapshot)
      : null;

  if (medicalHistorySnapshot) {
    setters.onMedicalHistorySnapshot?.(medicalHistorySnapshot);
  }

  return { hydrated, medicalHistorySnapshot };
}
