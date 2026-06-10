/** Keys for PUT/GET /api/visits/{visitId}/optometry-segments/{segmentKey} */
export const OPTOMETRY_SEGMENT_KEYS = {
  visualAcuityBundle: 'visual_acuity_bundle',
  iopBundle: 'iop_bundle',
  medicalHistoryBundle: 'medical_history_bundle',
  pupilExam: 'pupil_exam',
  anteriorSegment: 'anterior_segment',
  posteriorSegment: 'posterior_segment',
  fundusExam: 'fundus_exam',
  vitreousExam: 'vitreous_exam',
  peripheralRetinaExam: 'peripheral_retina_exam',
  wetRetinoscopy: 'wet_retinoscopy',
  dryRetinoscopy: 'dry_retinoscopy',
  subjectiveRefraction: 'subjective_refraction',
  prescriptionItems: 'prescription_items',
  doctorReferrals: 'doctor_referrals',
  imagingOrders: 'imaging_orders',
  receptionReferrals: 'reception_referrals',
  diagnoses: 'diagnoses',
  adviceBundle: 'advice_bundle',
  opticalBundle: 'optical_bundle',
} as const;

export type OptometrySegmentKey =
  (typeof OPTOMETRY_SEGMENT_KEYS)[keyof typeof OPTOMETRY_SEGMENT_KEYS];
