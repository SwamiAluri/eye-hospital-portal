/** Types for GET /api/patients/{id}/optometry-exams/history */

import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import type { IopSectionId } from './iop-section-constants';
import type { OptometryExamTabId } from './optometry-exam-types';
import type { VaSectionId } from './visual-acuity-constants';

export interface OptometryHistoryUser {
  userId: string;
  displayName: string;
}

export type MedicalHistoryBundle = MedicalHistorySnapshot & { version?: 1 };

export interface OptometryVisitSummary {
  medicalHistoryLine?: string;
  distanceVaLine?: string;
  previousGlassesLine?: string;
  todaysRxLine?: string;
  refractionLine?: string;
  iopNctLine?: string;
  keratometryLine?: string;
  anteriorSegmentLine?: string;
  posteriorSegmentLine?: string;
  vaSectionsRecorded: VaSectionId[];
  iopSectionsRecorded: IopSectionId[];
  tabsWithData: OptometryExamTabId[];
}

export interface OptometrySegmentBundle {
  visual_acuity_bundle?: VisualAcuityBundle;
  iop_bundle?: IopBundle;
  medical_history_bundle?: MedicalHistoryBundle;
  wet_retinoscopy?: unknown;
  dry_retinoscopy?: unknown;
  subjective_refraction?: unknown;
  pupil_exam?: unknown;
  anterior_segment?: unknown;
  posterior_segment?: unknown;
  fundus_exam?: unknown;
  vitreous_exam?: unknown;
  peripheral_retina_exam?: unknown;
  prescription_items?: unknown;
  optical_bundle?: unknown;
  doctor_referrals?: unknown;
  imaging_orders?: unknown;
  reception_referrals?: unknown;
  diagnoses?: unknown;
  advice_bundle?: unknown;
  [key: string]: unknown;
}

export interface VisualAcuityBundle {
  version?: 1;
  oldGlass?: {
    OD: { sphere: string; cylinder: string; axis: string; va: string };
    OS: { sphere: string; cylinder: string; axis: string; va: string };
  };
  newPrescription?: {
    OD: { sphere: string; cylinder: string; axis: string; va: string };
    OS: { sphere: string; cylinder: string; axis: string; va: string };
  };
  refraction?: {
    OD: { sphere: string; cylinder: string; axis: string };
    OS: { sphere: string; cylinder: string; axis: string };
  };
  distanceVision?: {
    OD: { unaided: string; aided: string };
    OS: { unaided: string; aided: string };
  };
  nearVision?: {
    OD: { unaided: string; aided: string };
    OS: { unaided: string; aided: string };
  };
  projectionRays?: unknown;
  keratometry?: {
    OD: { k1: string; k2: string; axis: string };
    OS: { k1: string; k2: string; axis: string };
  };
  colorVision?: { testType: string; result: string; platesMissed: string };
  contrastSensitivity?: {
    testType: string;
    OD: { score: string; interpretation: string };
    OS: { score: string; interpretation: string };
  };
  sectionRecorded?: Partial<Record<VaSectionId, boolean>>;
  sectionRecordedAt?: Partial<Record<VaSectionId, string>>;
  sectionSnapshots?: Partial<Record<VaSectionId, unknown>>;
}

export interface IopBundle {
  version?: 1;
  nct?: {
    beforeDilatation: {
      OD: { value: string; time: string };
      OS: { value: string; time: string };
    };
    afterDilatation: {
      OD: { value: string; time: string };
      OS: { value: string; time: string };
    };
  };
  atn?: IopBundle['nct'];
  schirmer?: {
    OD: { measurement: string; time: string; interpretation: string };
    OS: { measurement: string; time: string; interpretation: string };
  };
  pachymetry?: {
    OD: { cct: string; correctedIOP: string };
    OS: { cct: string; correctedIOP: string };
  };
  visualField?: {
    OD: { testType: string; md: string; psd: string; reliability: string; defects: string };
    OS: { testType: string; md: string; psd: string; reliability: string; defects: string };
  };
  sectionRecorded?: Partial<Record<IopSectionId, boolean>>;
  sectionRecordedAt?: Partial<Record<IopSectionId, string>>;
  sectionSnapshots?: Partial<Record<IopSectionId, unknown>>;
}

export interface OptometryVisitExamRecord {
  visitId: string;
  patientId: string;
  examinationDate: string;
  visitStatus: string;
  chiefComplaint?: string | null;
  lastUpdatedAt: string;
  lastUpdatedBy?: OptometryHistoryUser;
  optometryCompleted: boolean;
  optometryCompletedAt?: string | null;
  summary: OptometryVisitSummary;
  segments: OptometrySegmentBundle;
}

export interface OptometryPatientHistoryResponse {
  patientId: string;
  generatedAt: string;
  visits: OptometryVisitExamRecord[];
}

export interface OptometryLatestPriorResponse {
  found: boolean;
  visit?: OptometryVisitExamRecord;
}

export interface VaSectionPriorHistoryRow {
  examinationDate: string;
  visitId: string;
  snapshot: unknown;
  summary: string;
}
