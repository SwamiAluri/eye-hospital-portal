import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';
import type { CoverageEstimateLineItem } from '@/lib/counsellors-desk/coverage-estimate-sync';
import { toCounsellingDateOnly } from '@/lib/counsellors-desk/session-utils';

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
    const normalized = toCounsellingDateOnly(form.surgeryDate);
    if (normalized) patch.surgeryDate = normalized;
  }

  // Financial fields are counselling → coverage only; never sync estimate totals back.

  if (form.paymentType?.trim()) {
    patch.paymentType = form.paymentType.trim();
  }

  if (form.procedureCode?.trim()) {
    patch.procedureCode = form.procedureCode.trim();
  }

  if (form.surgeryProcedureLabel?.trim()) {
    patch.surgeryProcedureLabel = form.surgeryProcedureLabel.trim();
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
