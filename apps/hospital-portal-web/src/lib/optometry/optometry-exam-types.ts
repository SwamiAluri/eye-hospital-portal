/** Optometry examination draft & prior-visit types (visit-scoped UI state). */

import type { AnteriorSegmentExamData, PupilExamData } from './anterior-segment-types';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';

export type OptometryExamTabId =
  | 'medical-history'
  | 'visual-acuity'
  | 'iop'
  | 'retinoscopy'
  | 'anterior'
  | 'posterior'
  | 'medications'
  | 'optical-prescription'
  | 'referral'
  | 'diagnosis'
  | 'advice';

export const OPTOMETRY_TAB_ORDER: { id: OptometryExamTabId; label: string; step: number }[] = [
  { id: 'medical-history', label: 'Medical History', step: 1 },
  { id: 'visual-acuity', label: 'Visual Acuity', step: 2 },
  { id: 'iop', label: 'IOP', step: 3 },
  { id: 'retinoscopy', label: 'Retinoscopy', step: 4 },
  { id: 'anterior', label: 'Anterior Segment', step: 5 },
  { id: 'posterior', label: 'Posterior Segment', step: 6 },
  { id: 'medications', label: 'Medications', step: 7 },
  { id: 'optical-prescription', label: 'Optical Prescription', step: 8 },
  { id: 'referral', label: 'Referral & Orders', step: 9 },
  { id: 'diagnosis', label: 'Diagnosis', step: 10 },
  { id: 'advice', label: 'Advice & Patient Education', step: 11 },
];

export type TabSaveStatus = 'idle' | 'dirty' | 'saved' | 'error';

export interface PriorVisitRxEye {
  sphere?: string;
  cylinder?: string;
  axis?: string;
  visualAcuity?: string;
}

export interface PriorVisitSnapshot {
  examinationDate?: string;
  visualAcuity?: {
    distanceOD?: string;
    distanceOS?: string;
    distanceODUnaided?: string;
    distanceODAided?: string;
    distanceOSUnaided?: string;
    distanceOSAided?: string;
    nearOD?: string;
    nearOS?: string;
    nearODUnaided?: string;
    nearODAided?: string;
    nearOSUnaided?: string;
    nearOSAided?: string;
  };
  refraction?: {
    finalRxOD?: PriorVisitRxEye;
    finalRxOS?: PriorVisitRxEye;
    startingRxOD?: PriorVisitRxEye;
    startingRxOS?: PriorVisitRxEye;
  };
  iop?: {
    od?: number | string;
    os?: number | string;
    method?: string;
  };
  keratometry?: {
    od?: { k1?: string; k2?: string; axis?: string };
    os?: { k1?: string; k2?: string; axis?: string };
  };
  raw?: Record<string, unknown>;
}

/** Serialized visit examination (stored in ExaminationDraft + localStorage). */
export interface OptometryExamDraftData {
  version: 1;
  visitId: string;
  patientId: string;
  complaint?: string;
  savedAt?: string;
  tabStatus?: Partial<Record<OptometryExamTabId, TabSaveStatus>>;
  visualAcuityData?: unknown;
  refractionData?: unknown;
  autoRefractionData?: unknown;
  keratometryData?: unknown;
  colorVisionData?: unknown;
  contrastSensitivityData?: unknown;
  tonometryData?: unknown;
  pachymetryData?: unknown;
  visualFieldData?: unknown;
  vaExtended?: unknown;
  iopExtended?: unknown;
  wetRetinoscopy?: unknown;
  dryRetinoscopy?: unknown;
  subjectiveRefraction?: unknown;
  retinoscopyData?: unknown;
  pupilExam?: PupilExamData | null;
  anteriorSegment?: AnteriorSegmentExamData | null;
  posteriorSegment?: PosteriorSegmentExamData | null;
  fundusExam?: FundusExamData | null;
  vitreousExam?: VitreousExamData | null;
  peripheralRetinaExam?: PeripheralRetinaExamData | null;
  currentMedications?: unknown;
  prescriptionItems?: unknown;
  clAssessment?: unknown;
  clPrescription?: unknown;
  clFitting?: unknown;
  clCornealHealth?: unknown;
  clInstructions?: unknown;
  spectacleDispensing?: unknown;
  doctorReferrals?: unknown;
  imagingOrders?: unknown;
  receptionReferrals?: unknown;
  diagnoses?: unknown;
  adviceInstructions?: unknown;
  adviceFollowUp?: unknown;
  advicePrecautions?: unknown;
  adviceEducation?: unknown;
  /** In-progress medical history (patient record fields) for autosave recovery. */
  medicalHistorySnapshot?: unknown;
}
