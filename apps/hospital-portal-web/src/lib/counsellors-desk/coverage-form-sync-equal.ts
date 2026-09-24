import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';

/**
 * Snapshot of counselling→coverage sync fields used to keep setForm idempotent.
 * Prevents render/effect loops when mergeFormWithCounsellingSession always spreads a new object.
 */
export function coverageFormSyncSnapshot(form: CoveragePanelForm): string {
  return JSON.stringify({
    insurerName: form.insurerName ?? null,
    insuranceProviderId: form.insuranceProviderId ?? null,
    paymentType: form.paymentType ?? null,
    estimatedAmount: form.estimatedAmount ?? null,
    estimatedSurgery: form.estimatedSurgery ?? null,
    estimatedLab: form.estimatedLab ?? null,
    estimatedOther: form.estimatedOther ?? null,
    surgeryProcedureLabel: form.surgeryProcedureLabel ?? null,
    procedureCode: form.procedureCode ?? null,
    surgeryDate: form.surgeryDate ?? null,
    clinicalNotes: form.clinicalNotes ?? null,
    estimateLineItems: form.estimateLineItems ?? null,
  });
}

export function coverageFormsSyncEqual(
  a: CoveragePanelForm,
  b: CoveragePanelForm,
): boolean {
  return coverageFormSyncSnapshot(a) === coverageFormSyncSnapshot(b);
}
