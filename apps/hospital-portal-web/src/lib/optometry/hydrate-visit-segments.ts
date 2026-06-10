import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import type { OptometrySegmentExamDto } from '@/lib/api/optometry-segment.api';
import {
  medicalHistorySnapshotHasClinicalData,
  normalizeMedicalHistoryBundleData,
} from '@/lib/medical-history/medical-history-snapshot';
import type { ExamDraftSetters } from './apply-exam-draft';
import { OPTOMETRY_SEGMENT_KEYS } from './optometry-segment-keys';
import {
  applyIopClinicalFromBundle,
  applyVaClinicalFromBundle,
} from './hydrate-clinical-from-bundle';
import {
  applyVisitExamDefaults,
  normalizeSpectacleDraft,
} from './visit-segment-defaults';
import type { OptometrySegmentKeyValue } from './segment-hydration.types';
import { VISIT_BUNDLE_SEGMENT_KEYS } from './segment-hydration.types';

export interface HydrateVisitSegmentsResult {
  loadedSegmentKeys: Set<string>;
  missingKeys: OptometrySegmentKeyValue[];
  mhVisitSnapshot: MedicalHistorySnapshot | null;
  /** True when segment row exists and has clinical MH data (draft MH should be skipped). */
  skipDraftMedicalHistory: boolean;
}

function buildSegmentMap(rows: OptometrySegmentExamDto[]): Map<string, unknown> {
  return new Map(rows.map((r) => [r.segmentKey, r.data]));
}

export interface HydrateVisitSegmentsOptions {
  patientId?: string;
  examinerId?: string;
}

/** Canonical visit-segment hydration — segment data wins over any later draft overlay. */
export function hydrateVisitSegments(
  rows: OptometrySegmentExamDto[],
  setters: ExamDraftSetters,
  options?: HydrateVisitSegmentsOptions,
): HydrateVisitSegmentsResult {
  applyVisitExamDefaults(setters);

  const map = buildSegmentMap(rows);
  const loadedSegmentKeys = new Set<string>();

  const markLoaded = (key: string, data: unknown) => {
    if (data == null) return;
    loadedSegmentKeys.add(key);
  };

  const mhRaw = map.get(OPTOMETRY_SEGMENT_KEYS.medicalHistoryBundle);
  const mhSnap =
    mhRaw != null ? normalizeMedicalHistoryBundleData(mhRaw) : null;
  const mhVisitSnapshot =
    mhSnap && medicalHistorySnapshotHasClinicalData(mhSnap) ? mhSnap : null;
  if (mhVisitSnapshot) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.medicalHistoryBundle, mhRaw);
  }

  const vaBundle = map.get(OPTOMETRY_SEGMENT_KEYS.visualAcuityBundle);
  if (vaBundle != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.visualAcuityBundle, vaBundle);
    setters.setVaExtended(vaBundle);
    if (options?.patientId) {
      applyVaClinicalFromBundle(
        vaBundle,
        options.patientId,
        options.examinerId ?? '',
        setters,
      );
    }
  }

  const iopBundle = map.get(OPTOMETRY_SEGMENT_KEYS.iopBundle);
  if (iopBundle != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.iopBundle, iopBundle);
    setters.setIopExtended(iopBundle);
    if (options?.patientId) {
      applyIopClinicalFromBundle(
        iopBundle,
        options.patientId,
        options.examinerId ?? '',
        setters,
      );
    }
  }

  const wet = map.get(OPTOMETRY_SEGMENT_KEYS.wetRetinoscopy);
  if (wet != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.wetRetinoscopy, wet);
    setters.setWetRetinoscopy(wet);
  }

  const dry = map.get(OPTOMETRY_SEGMENT_KEYS.dryRetinoscopy);
  if (dry != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.dryRetinoscopy, dry);
    setters.setDryRetinoscopy(dry);
  }

  const subj = map.get(OPTOMETRY_SEGMENT_KEYS.subjectiveRefraction);
  if (subj != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.subjectiveRefraction, subj);
    setters.setSubjectiveRefraction(subj);
  }

  const pupil = map.get(OPTOMETRY_SEGMENT_KEYS.pupilExam);
  if (pupil != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.pupilExam, pupil);
    setters.setPupilExam(pupil);
  }

  const anterior = map.get(OPTOMETRY_SEGMENT_KEYS.anteriorSegment);
  if (anterior != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.anteriorSegment, anterior);
    setters.setAnteriorSegment(anterior);
  }

  const posterior = map.get(OPTOMETRY_SEGMENT_KEYS.posteriorSegment);
  if (posterior != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.posteriorSegment, posterior);
    setters.setPosteriorSegment(posterior);
  }

  const fundus = map.get(OPTOMETRY_SEGMENT_KEYS.fundusExam);
  if (fundus != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.fundusExam, fundus);
    setters.setFundusExam(fundus);
  }

  const vitreous = map.get(OPTOMETRY_SEGMENT_KEYS.vitreousExam);
  if (vitreous != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.vitreousExam, vitreous);
    setters.setVitreousExam(vitreous);
  }

  const peripheralRetina = map.get(OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam);
  if (peripheralRetina != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam, peripheralRetina);
    setters.setPeripheralRetinaExam(peripheralRetina);
  }

  const rxItems = map.get(OPTOMETRY_SEGMENT_KEYS.prescriptionItems);
  if (rxItems != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.prescriptionItems, rxItems);
    setters.setPrescriptionItems(rxItems);
  }

  const optical = map.get(OPTOMETRY_SEGMENT_KEYS.opticalBundle) as
    | Record<string, unknown>
    | undefined;
  if (optical != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.opticalBundle, optical);
    if (optical.assessment != null) setters.setClAssessment(optical.assessment);
    if (optical.prescription != null) setters.setClPrescription(optical.prescription);
    if (optical.fitting != null) setters.setClFitting(optical.fitting);
    if (optical.cornealHealth != null) setters.setClCornealHealth(optical.cornealHealth);
    if (optical.instructions != null) setters.setClInstructions(optical.instructions);
    if (optical.spectacleDispensing != null) {
      setters.setSpectacleDispensing(normalizeSpectacleDraft(optical.spectacleDispensing));
    }
  }

  const doctorReferrals = map.get(OPTOMETRY_SEGMENT_KEYS.doctorReferrals);
  if (doctorReferrals != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.doctorReferrals, doctorReferrals);
    setters.setDoctorReferrals(doctorReferrals);
  }

  const imagingOrders = map.get(OPTOMETRY_SEGMENT_KEYS.imagingOrders);
  if (imagingOrders != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.imagingOrders, imagingOrders);
    setters.setImagingOrders(imagingOrders);
  }

  const receptionReferrals = map.get(OPTOMETRY_SEGMENT_KEYS.receptionReferrals);
  if (receptionReferrals != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.receptionReferrals, receptionReferrals);
    setters.setReceptionReferrals(receptionReferrals);
  }

  const diagnoses = map.get(OPTOMETRY_SEGMENT_KEYS.diagnoses);
  if (diagnoses != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.diagnoses, diagnoses);
    setters.setDiagnoses(diagnoses);
  }

  const advice = map.get(OPTOMETRY_SEGMENT_KEYS.adviceBundle) as
    | Record<string, unknown>
    | undefined;
  if (advice != null) {
    markLoaded(OPTOMETRY_SEGMENT_KEYS.adviceBundle, advice);
    if (advice.instructions != null) setters.setAdviceInstructions(advice.instructions);
    if (advice.followUp != null) setters.setAdviceFollowUp(advice.followUp);
    if (advice.precautions != null) setters.setAdvicePrecautions(advice.precautions);
    if (advice.education != null) setters.setAdviceEducation(advice.education);
  }

  const missingKeys = VISIT_BUNDLE_SEGMENT_KEYS.filter((k) => !loadedSegmentKeys.has(k));

  return {
    loadedSegmentKeys,
    missingKeys,
    mhVisitSnapshot,
    skipDraftMedicalHistory: mhVisitSnapshot != null,
  };
}
