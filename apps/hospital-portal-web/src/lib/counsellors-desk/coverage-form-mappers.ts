import type { UpdateCoverageCaseRequest } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import {
  aggregateLineItems,
  type CoverageEstimateFieldKey,
  type CoverageEstimateLineItem,
  type CoverageSyncSource,
} from '@/lib/counsellors-desk/coverage-estimate-sync';
import type {
  CostEstimateForm,
  CoverageSplit,
  InsuranceDetailsForm,
} from '@/components/counsellors-desk/coverage/useCoverageForm';
import { isCcmsUuid } from '@/lib/ccms/ccms-ids';

export type CoveragePanelForm = UpdateCoverageCaseRequest & {
  financialYear?: string;
  estimateLineItems?: CoverageEstimateLineItem[];
  surgeryProcedureLabel?: string;
  estimateSyncSources?: Partial<Record<CoverageEstimateFieldKey, CoverageSyncSource>>;
  manualCovered?: number;
  serviceTaxApplicable?: boolean;
  serviceTaxPercent?: number;
};

function numToStr(v?: number | null): string {
  return v != null && v > 0 ? String(v) : '';
}

function draftExtras(draft: CounsellorDraftSnapshot | null | undefined): Partial<CoveragePanelForm> {
  if (!draft) return {};
  const d = draft as CounsellorDraftSnapshot & {
    estimateLineItems?: CoverageEstimateLineItem[];
    surgeryProcedureLabel?: string;
    manualCovered?: number | string;
    serviceTaxApplicable?: boolean;
    serviceTaxPercent?: number | string;
  };
  return {
    financialYear: draft.financialYear,
    policyExpiry: draft.policyExpiry,
    relationshipToInsured: draft.relationshipToInsured as CoveragePanelForm['relationshipToInsured'],
    roomClassEntitlement: draft.roomClassEntitlement as CoveragePanelForm['roomClassEntitlement'],
    estimateLineItems: d.estimateLineItems,
    surgeryProcedureLabel: d.surgeryProcedureLabel,
    manualCovered:
      d.manualCovered != null && d.manualCovered !== '' ? Number(d.manualCovered) : undefined,
    serviceTaxApplicable: d.serviceTaxApplicable,
    serviceTaxPercent:
      d.serviceTaxPercent != null && d.serviceTaxPercent !== ''
        ? Number(d.serviceTaxPercent)
        : undefined,
  };
}

/** Map panel/CCMS draft fields → InsuranceDetailsTab form. */
export function toInsuranceDetailsForm(
  form: CoveragePanelForm,
  counsellingProviderId?: string,
): InsuranceDetailsForm {
  return {
    insurerName: form.insurerName ?? '',
    insuranceProviderId: form.insuranceProviderId ?? counsellingProviderId ?? '',
    policyNumber: form.policyNumber ?? '',
    membershipNumber: form.membershipNumber ?? '',
    insuredName: form.insuredName ?? '',
    relationshipToInsured: (form.relationshipToInsured as InsuranceDetailsForm['relationshipToInsured']) ?? '',
    sumInsured: form.sumInsured != null ? String(form.sumInsured) : '',
    coPay: form.coPay != null ? String(form.coPay) : '',
    roomClassEntitlement: (form.roomClassEntitlement as InsuranceDetailsForm['roomClassEntitlement']) ?? '',
    networkHospitalConfirmed: form.networkHospitalConfirmed ?? null,
    policyExpiry: form.policyExpiry ?? '',
    financialYear: form.financialYear ?? '',
    coverageNotes: form.coverageNotes ?? '',
  };
}

/** Map panel/CCMS draft fields → CoverageEstimateTab form. */
export function toCostEstimateForm(
  form: CoveragePanelForm,
  sessionSurgery?: string,
): CostEstimateForm {
  return {
    surgeryProcedure: form.surgeryProcedureLabel ?? sessionSurgery ?? '',
    surgeryDate: form.surgeryDate?.slice(0, 10) ?? '',
    diagnosisCode: form.diagnosisCode ?? '',
    procedureCode: form.procedureCode ?? '',
    urgencyLevel: (form.urgencyLevel as CostEstimateForm['urgencyLevel']) ?? '',
    estimatedSurgery: numToStr(form.estimatedSurgery),
    estimatedRoom: numToStr(form.estimatedRoom),
    estimatedMedicines: numToStr(form.estimatedMedicines),
    estimatedLab: numToStr(form.estimatedLab),
    estimatedOther: numToStr(form.estimatedOther),
    lineItems: form.estimateLineItems ?? [],
    manualCovered: numToStr(form.manualCovered),
    serviceTaxApplicable: form.serviceTaxApplicable ?? false,
    serviceTaxPercent:
      form.serviceTaxPercent != null && form.serviceTaxPercent > 0
        ? String(form.serviceTaxPercent)
        : '',
    tpaContactPerson: form.tpaContactPerson ?? '',
    tpaContactEmail: form.tpaContactEmail ?? '',
    tpaContactPhone: form.tpaContactPhone ?? '',
    clinicalNotes: form.clinicalNotes ?? '',
    counsellingFinalPayable:
      form.estimatedAmount != null && form.estimatedAmount > 0 ? form.estimatedAmount : undefined,
  };
}

/** Merge tab form patches back into UpdateCoverageCaseRequest. */
export function mergeInsurancePatch(
  base: CoveragePanelForm,
  patch: Partial<InsuranceDetailsForm>,
): CoveragePanelForm {
  const next: CoveragePanelForm = { ...base };

  if (patch.insurerName !== undefined) next.insurerName = patch.insurerName || undefined;
  if (patch.insuranceProviderId !== undefined) {
    next.insuranceProviderId = patch.insuranceProviderId || undefined;
  }
  if (patch.policyNumber !== undefined) next.policyNumber = patch.policyNumber || undefined;
  if (patch.membershipNumber !== undefined) next.membershipNumber = patch.membershipNumber || undefined;
  if (patch.insuredName !== undefined) next.insuredName = patch.insuredName || undefined;
  if (patch.relationshipToInsured !== undefined) {
    next.relationshipToInsured = patch.relationshipToInsured || undefined;
  }
  if (patch.sumInsured !== undefined) {
    next.sumInsured = patch.sumInsured ? Number(patch.sumInsured) : undefined;
  }
  if (patch.coPay !== undefined) {
    next.coPay = patch.coPay ? Number(patch.coPay) : undefined;
  }
  if (patch.roomClassEntitlement !== undefined) {
    next.roomClassEntitlement = patch.roomClassEntitlement || undefined;
  }
  if (patch.networkHospitalConfirmed !== undefined) {
    next.networkHospitalConfirmed = patch.networkHospitalConfirmed ?? undefined;
  }
  if (patch.policyExpiry !== undefined) next.policyExpiry = patch.policyExpiry || undefined;
  if (patch.financialYear !== undefined) next.financialYear = patch.financialYear || undefined;
  if (patch.coverageNotes !== undefined) next.coverageNotes = patch.coverageNotes || undefined;

  return next;
}

function parseAmount(v: string): number | undefined {
  const n = parseFloat(v);
  return n > 0 ? n : undefined;
}

export function mergeEstimatePatch(
  base: CoveragePanelForm,
  patch: Partial<CostEstimateForm>,
): CoveragePanelForm {
  const next: CoveragePanelForm = { ...base };

  const markManual = (key: CoverageEstimateFieldKey) => {
    next.estimateSyncSources = { ...next.estimateSyncSources, [key]: 'manual' as const };
  };

  if (patch.surgeryProcedure !== undefined) {
    next.surgeryProcedureLabel = patch.surgeryProcedure || undefined;
    markManual('surgeryProcedureLabel');
  }
  if (patch.surgeryDate !== undefined) next.surgeryDate = patch.surgeryDate || undefined;
  if (patch.diagnosisCode !== undefined) next.diagnosisCode = patch.diagnosisCode || undefined;
  if (patch.procedureCode !== undefined) {
    next.procedureCode = patch.procedureCode || undefined;
    markManual('procedureCode');
  }
  if (patch.clinicalNotes !== undefined) next.clinicalNotes = patch.clinicalNotes || undefined;
  if (patch.tpaContactPerson !== undefined) next.tpaContactPerson = patch.tpaContactPerson || undefined;
  if (patch.tpaContactEmail !== undefined) next.tpaContactEmail = patch.tpaContactEmail || undefined;
  if (patch.tpaContactPhone !== undefined) next.tpaContactPhone = patch.tpaContactPhone || undefined;
  if (patch.urgencyLevel !== undefined) {
    next.urgencyLevel = patch.urgencyLevel || undefined;
  }
  if (patch.manualCovered !== undefined) {
    const n = parseFloat(patch.manualCovered);
    next.manualCovered = n > 0 ? n : undefined;
  }
  if (patch.serviceTaxApplicable !== undefined) {
    next.serviceTaxApplicable = patch.serviceTaxApplicable;
  }
  if (patch.serviceTaxPercent !== undefined) {
    const n = parseFloat(patch.serviceTaxPercent);
    next.serviceTaxPercent = n > 0 ? n : undefined;
  }

  if (patch.estimatedSurgery !== undefined) {
    next.estimatedSurgery = parseAmount(patch.estimatedSurgery);
    markManual('estimatedSurgery');
  }
  if (patch.estimatedRoom !== undefined) next.estimatedRoom = parseAmount(patch.estimatedRoom);
  if (patch.estimatedMedicines !== undefined) {
    next.estimatedMedicines = parseAmount(patch.estimatedMedicines);
  }
  if (patch.estimatedLab !== undefined) {
    next.estimatedLab = parseAmount(patch.estimatedLab);
    markManual('estimatedLab');
  }
  if (patch.estimatedOther !== undefined) {
    next.estimatedOther = parseAmount(patch.estimatedOther);
    markManual('estimatedOther');
  }

  if (patch.lineItems !== undefined) {
    next.estimateLineItems = patch.lineItems.map((item) => ({
      ...item,
      syncSource: 'manual' as const,
    }));
    const agg = aggregateLineItems(next.estimateLineItems);
    next.estimatedSurgery = agg.estimatedSurgery || undefined;
    next.estimatedLab = agg.estimatedLab || undefined;
    next.estimatedOther = agg.estimatedOther || undefined;
    next.estimateSyncSources = {
      ...next.estimateSyncSources,
      estimatedSurgery: 'manual',
      estimatedLab: 'manual',
      estimatedOther: 'manual',
    };
  }

  const medicalTotal =
    (next.estimatedSurgery ?? 0) +
    (next.estimatedRoom ?? 0) +
    (next.estimatedMedicines ?? 0) +
    (next.estimatedLab ?? 0) +
    (next.estimatedOther ?? 0);
  next.estimatedAmount = medicalTotal > 0 ? medicalTotal : next.estimatedAmount;

  return next;
}

function resolveMedicalTotal(estimate: CostEstimateForm): number {
  const n = (v: string) => parseFloat(v) || 0;
  if (estimate.lineItems.length > 0) {
    const agg = aggregateLineItems(estimate.lineItems);
    return (
      agg.estimatedSurgery +
      agg.estimatedLab +
      agg.estimatedOther +
      n(estimate.estimatedRoom) +
      n(estimate.estimatedMedicines)
    );
  }
  return (
    n(estimate.estimatedSurgery) +
    n(estimate.estimatedRoom) +
    n(estimate.estimatedMedicines) +
    n(estimate.estimatedLab) +
    n(estimate.estimatedOther)
  );
}

/** Coverage split from full cost breakdown fields. */
export function buildCoverageSplitFromForm(
  estimate: CostEstimateForm,
  coPayPercent: string,
  paymentType?: string,
): CoverageSplit {
  const n = (v: string) => parseFloat(v) || 0;
  let medicalTotal = resolveMedicalTotal(estimate);
  if (
    estimate.counsellingFinalPayable != null &&
    estimate.counsellingFinalPayable > medicalTotal
  ) {
    medicalTotal = estimate.counsellingFinalPayable;
  }

  const taxPct = n(estimate.serviceTaxPercent);
  const serviceTaxAmount =
    estimate.serviceTaxApplicable && taxPct > 0
      ? Math.round(medicalTotal * taxPct / 100)
      : 0;
  const total = medicalTotal;
  const totalWithTax = total + serviceTaxAmount;

  const isCopayMode = paymentType === 'CoPay' && n(coPayPercent) > 0;

  let insuranceCovered: number;
  let patientPayable: number;

  if (isCopayMode) {
    const frac = n(coPayPercent) / 100;
    patientPayable = Math.round(totalWithTax * frac);
    insuranceCovered = totalWithTax - patientPayable;
  } else {
    insuranceCovered = n(estimate.manualCovered);
    patientPayable = Math.max(0, totalWithTax - insuranceCovered);
  }

  return {
    total,
    insuranceCovered,
    patientPayable,
    isCopayMode,
    serviceTaxAmount,
    totalWithTax,
  };
}

/** Map panel form → CCMS update payload (financial year + counsellor draft JSON). */
export function toCoverageApiPayload(
  form: CoveragePanelForm,
  options?: { insuranceProviderId?: string },
): UpdateCoverageCaseRequest {
  const { financialYear, estimateLineItems, surgeryProcedureLabel, ...rest } = form;
  const providerId =
    options?.insuranceProviderId ??
    (isCcmsUuid(form.insuranceProviderId) ? form.insuranceProviderId : undefined);
  const draftSnapshot = {
    insurerName: form.insurerName,
    insuranceProviderId: form.insuranceProviderId,
    policyNumber: form.policyNumber,
    membershipNumber: form.membershipNumber,
    insuredName: form.insuredName,
    relationshipToInsured: form.relationshipToInsured,
    sumInsured: form.sumInsured,
    coPay: form.coPay,
    policyExpiry: form.policyExpiry,
    financialYear,
    roomClassEntitlement: form.roomClassEntitlement,
    networkHospitalConfirmed: form.networkHospitalConfirmed,
    coverageNotes: form.coverageNotes,
    surgeryDate: form.surgeryDate,
    estimatedSurgery: form.estimatedSurgery,
    estimatedRoom: form.estimatedRoom,
    estimatedMedicines: form.estimatedMedicines,
    estimatedLab: form.estimatedLab,
    estimatedOther: form.estimatedOther,
    estimatedAmount: form.estimatedAmount,
    estimateLineItems,
    surgeryProcedureLabel,
    procedureCode: form.procedureCode,
    diagnosisCode: form.diagnosisCode,
    clinicalNotes: form.clinicalNotes,
    paymentType: form.paymentType,
    urgencyLevel: form.urgencyLevel,
    manualCovered: form.manualCovered,
    serviceTaxApplicable: form.serviceTaxApplicable,
    serviceTaxPercent: form.serviceTaxPercent,
  };

  return {
    ...rest,
    insuranceProviderId: providerId,
    financialYearId: financialYear || form.financialYearId,
    counsellorDraftJson: JSON.stringify(draftSnapshot),
    isDraft: form.isDraft ?? true,
  };
}

export { draftExtras };
