import { OPTOMETRY_SEGMENT_KEYS } from './optometry-segment-keys';

export type OptometrySegmentKeyValue =
  (typeof OPTOMETRY_SEGMENT_KEYS)[keyof typeof OPTOMETRY_SEGMENT_KEYS];

/** Result of mapping a visit segment list to exam state (Phase 3). */
export interface VisitSegmentHydrationResult {
  /** Segment keys returned by listByVisit for this visit. */
  loadedKeys: string[];
  /** Expected bundle keys with no row yet (defaults apply). */
  missingKeys: OptometrySegmentKeyValue[];
}

/** All visit-scoped bundle keys loaded on exam open. */
export const VISIT_BUNDLE_SEGMENT_KEYS: OptometrySegmentKeyValue[] = [
  OPTOMETRY_SEGMENT_KEYS.medicalHistoryBundle,
  OPTOMETRY_SEGMENT_KEYS.visualAcuityBundle,
  OPTOMETRY_SEGMENT_KEYS.iopBundle,
  OPTOMETRY_SEGMENT_KEYS.wetRetinoscopy,
  OPTOMETRY_SEGMENT_KEYS.dryRetinoscopy,
  OPTOMETRY_SEGMENT_KEYS.subjectiveRefraction,
  OPTOMETRY_SEGMENT_KEYS.pupilExam,
  OPTOMETRY_SEGMENT_KEYS.anteriorSegment,
  OPTOMETRY_SEGMENT_KEYS.posteriorSegment,
  OPTOMETRY_SEGMENT_KEYS.fundusExam,
  OPTOMETRY_SEGMENT_KEYS.vitreousExam,
  OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam,
  OPTOMETRY_SEGMENT_KEYS.prescriptionItems,
  OPTOMETRY_SEGMENT_KEYS.opticalBundle,
  OPTOMETRY_SEGMENT_KEYS.doctorReferrals,
  OPTOMETRY_SEGMENT_KEYS.imagingOrders,
  OPTOMETRY_SEGMENT_KEYS.receptionReferrals,
  OPTOMETRY_SEGMENT_KEYS.diagnoses,
  OPTOMETRY_SEGMENT_KEYS.adviceBundle,
];
