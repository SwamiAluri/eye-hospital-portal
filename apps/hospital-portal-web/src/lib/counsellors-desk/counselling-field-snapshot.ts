import type { CounsellingEstimateState } from '@/types/counselling-estimate';
import type { CombinedPaymentType, DecisionType } from '@/types/counsellors-desk';

/** Serializable field snapshot for save diffing and session history audit. */
export type CounsellingFieldSnapshot = Record<string, string>;

export interface BuildCounsellingFieldSnapshotInput {
  paymentType: CombinedPaymentType | '';
  insuranceCompany: string;
  decision: DecisionType | '';
  followUpReason: string;
  followUpDate: string;
  counsellorNotes: string;
  patientRemarks: string;
  doctorNotes: string;
  wantToSeeDoctor: boolean;
  interestedToUpgrade: boolean;
  notRequiredPreAuth: boolean;
  selectedSurgeryId: string | null;
  selectedEye: string;
  packageName: string;
  packageRate: number | '';
  scheduleDate: string;
  mergedEstimate: CounsellingEstimateState;
}

export function buildCounsellingFieldSnapshot(
  input: BuildCounsellingFieldSnapshotInput,
): CounsellingFieldSnapshot {
  const { mergedEstimate: est } = input;
  return {
    paymentType: input.paymentType ?? '',
    insuranceCompany: input.insuranceCompany ?? '',
    decision: input.decision ?? '',
    followUpReason: input.followUpReason ?? '',
    followUpDate: input.followUpDate ?? '',
    counsellorNotes: input.counsellorNotes ?? '',
    patientRemarks: input.patientRemarks ?? '',
    doctorNotes: input.doctorNotes ?? '',
    wantToSeeDoctor: String(input.wantToSeeDoctor),
    interestedToUpgrade: String(input.interestedToUpgrade),
    notRequiredPreAuth: String(input.notRequiredPreAuth),
    selectedSurgeryId: input.selectedSurgeryId ?? '',
    selectedEye: input.selectedEye ?? '',
    packageName: input.packageName ?? '',
    packageRate: String(input.packageRate ?? ''),
    schedule: input.scheduleDate ?? '',
    estimateMode: est.estimateMode ?? 'custom',
    packageTemplateId: est.packageTemplateId ?? '',
    discountType: est.discountType ?? '',
    discountValue: String(est.discountValue ?? 0),
    discountReason: est.discountReason ?? '',
    discountAmount: String(est.discountAmount ?? 0),
    finalPayableAmount: String(est.finalPayableAmount ?? 0),
  };
}
