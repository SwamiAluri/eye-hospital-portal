import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';
import type { CoverageEstimateLineItem } from '@/lib/counsellors-desk/coverage-estimate-sync';

/** Shared counselling fields kept in sync with the Coverage workspace (in-memory only). */
export interface CounsellingWorkspaceSyncPatch {
  insuranceCompany?: string;
  insuranceProviderId?: string;
  surgeryDate?: string;
  estimatedAmount?: number;
  estimatedSurgery?: number;
  estimatedLab?: number;
  estimatedOther?: number;
  paymentType?: string;
  procedureCode?: string;
  surgeryProcedureLabel?: string;
  estimateLineItems?: CoverageEstimateLineItem[];
}

export interface CounsellingWorkspaceSnapshot {
  ccmsCaseNumber?: string;
  ccmsCurrentState?: string;
  paymentType?: string;
}

export function extractCounsellingSyncFromCoverageForm(
  form: CoveragePanelForm,
  insuranceProviderOptions: { value: string; label: string }[],
): CounsellingWorkspaceSyncPatch {
  const patch: CounsellingWorkspaceSyncPatch = {};

  if (form.insuranceProviderId) {
    patch.insuranceProviderId = form.insuranceProviderId;
  }
  if (form.insurerName?.trim()) {
    patch.insuranceCompany = form.insurerName.trim();
  } else if (form.insuranceProviderId) {
    const match = insuranceProviderOptions.find((o) => o.value === form.insuranceProviderId);
    if (match?.label) patch.insuranceCompany = match.label;
  }

  if (form.surgeryDate) {
    patch.surgeryDate = form.surgeryDate.slice(0, 10);
  }

  if (form.estimatedAmount != null && form.estimatedAmount > 0) {
    patch.estimatedAmount = form.estimatedAmount;
  }
  if (form.estimatedSurgery != null && form.estimatedSurgery > 0) {
    patch.estimatedSurgery = form.estimatedSurgery;
  }
  if (form.estimatedLab != null && form.estimatedLab > 0) {
    patch.estimatedLab = form.estimatedLab;
  }
  if (form.estimatedOther != null && form.estimatedOther > 0) {
    patch.estimatedOther = form.estimatedOther;
  }

  if (form.paymentType?.trim()) {
    patch.paymentType = form.paymentType.trim();
  }

  if (form.procedureCode?.trim()) {
    patch.procedureCode = form.procedureCode.trim();
  }

  if (form.surgeryProcedureLabel?.trim()) {
    patch.surgeryProcedureLabel = form.surgeryProcedureLabel.trim();
  }

  if (form.estimateLineItems?.length) {
    patch.estimateLineItems = form.estimateLineItems;
  }

  return patch;
}

export function counsellingSyncPatchesEqual(
  a: CounsellingWorkspaceSyncPatch,
  b: CounsellingWorkspaceSyncPatch,
): boolean {
  return (
    a.insuranceCompany === b.insuranceCompany &&
    a.insuranceProviderId === b.insuranceProviderId &&
    a.surgeryDate === b.surgeryDate &&
    a.estimatedAmount === b.estimatedAmount &&
    a.estimatedSurgery === b.estimatedSurgery &&
    a.estimatedLab === b.estimatedLab &&
    a.estimatedOther === b.estimatedOther &&
    a.paymentType === b.paymentType &&
    a.procedureCode === b.procedureCode &&
    a.surgeryProcedureLabel === b.surgeryProcedureLabel &&
    JSON.stringify(a.estimateLineItems ?? []) === JSON.stringify(b.estimateLineItems ?? [])
  );
}
