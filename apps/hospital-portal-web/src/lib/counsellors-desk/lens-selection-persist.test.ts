import { describe, expect, it } from 'vitest';
import {
  mergeEstimateIntoBlob,
  restoreLensSelectionFromBlob,
} from '@/lib/counsellors-desk/package-addons-blob';
import { buildCounsellingSessionPayload } from '@/lib/counsellors-desk/save-counselling-session';
import type { CounsellingSession } from '@/types/counsellors-desk';
import { EMPTY_COUNSELLING_ESTIMATE } from '@/types/counselling-estimate';

describe('restoreLensSelectionFromBlob', () => {
  it('restores variantSubOption and selectedIolId from package addons blob', () => {
    expect(
      restoreLensSelectionFromBlob({
        variantSubOption: 'CT Lucia',
        selectedIolId: 'iol-tecnis-1',
      }),
    ).toEqual({
      variantSubOption: 'CT Lucia',
      selectedIolId: 'iol-tecnis-1',
    });
  });

  it('returns nulls when blob lacks lens selection', () => {
    expect(restoreLensSelectionFromBlob({})).toEqual({
      variantSubOption: null,
      selectedIolId: null,
    });
    expect(restoreLensSelectionFromBlob(null)).toEqual({
      variantSubOption: null,
      selectedIolId: null,
    });
  });

  it('trims empty strings to null', () => {
    expect(
      restoreLensSelectionFromBlob({
        variantSubOption: '  ',
        selectedIolId: '',
      }),
    ).toEqual({
      variantSubOption: null,
      selectedIolId: null,
    });
  });
});

describe('lens selection save → blob round-trip', () => {
  const session = {
    id: 's1',
    patientId: 'p1',
    patientName: 'Test',
    age: 70,
    gender: 'Male',
    uhid: 'FRESH-013',
    visitDate: '2026-09-04',
    surgeries: [],
    selectedSurgeryId: null,
    patientType: 'Cash',
    paymentMode: 'Cash',
    company: '',
    freeSurgeryReason: '',
    packageName: '',
    packageRate: '',
    decision: '',
    schedule: null,
    counsellorNotes: '',
    patientRemarks: '',
    doctorNotes: '',
    wantToSeeDoctor: false,
    interestedToUpgrade: false,
    notRequiredPreAuth: false,
    isFollowUpRequired: false,
    status: 'Processed',
  } as CounsellingSession;

  it('persists variantSubOption and selectedIolId inside packageAddonsJson', () => {
    const { payload } = buildCounsellingSessionPayload({
      sessionId: 's1',
      session,
      selectedSurgeryId: 'type-var-1-RE',
      selectedVariantId: 'var-1',
      selectedEye: 'RE',
      selectedIolId: 'iol-1',
      variantSubOption: 'Tecnis',
      packageName: '',
      packageRate: '',
      paymentType: 'Cash',
      insuranceCompany: '',
      insuranceProviderId: undefined,
      freeSurgeryReason: '',
      decision: '',
      followUpReason: '',
      followUpDate: '',
      counsellorNotes: '',
      patientRemarks: '',
      doctorNotes: '',
      wantToSeeDoctor: false,
      interestedToUpgrade: false,
      notRequiredPreAuth: false,
      schedule: null,
      selectedInvestigations: new Map(),
      mergedEstimate: { ...EMPTY_COUNSELLING_ESTIMATE, finalPayableAmount: 53475 },
      savedSnapshot: {},
      isDoneState: false,
      existingOtScheduleId: null,
      onSuccess: () => undefined,
      invalidateWaitingList: () => undefined,
      invalidateSession: () => undefined,
    });

    const blob = JSON.parse(payload.packageAddonsJson as string);
    expect(blob.variantSubOption).toBe('Tecnis');
    expect(blob.selectedIolId).toBe('iol-1');
    expect(restoreLensSelectionFromBlob(blob)).toEqual({
      variantSubOption: 'Tecnis',
      selectedIolId: 'iol-1',
    });
  });

  it('persists Hoya and Alcon selectedIolId values inside packageAddonsJson', () => {
    for (const selectedIolId of ['iol-hoya', 'iol-alcon'] as const) {
      const { payload } = buildCounsellingSessionPayload({
        sessionId: 's1',
        session,
        selectedSurgeryId: 'type-var-edof-RE',
        selectedVariantId: 'var-edof',
        selectedEye: 'RE',
        selectedIolId,
        variantSubOption: null,
        packageName: '',
        packageRate: '',
        paymentType: 'Cash',
        insuranceCompany: '',
        insuranceProviderId: undefined,
        freeSurgeryReason: '',
        decision: '',
        followUpReason: '',
        followUpDate: '',
        counsellorNotes: '',
        patientRemarks: '',
        doctorNotes: '',
        wantToSeeDoctor: false,
        interestedToUpgrade: false,
        notRequiredPreAuth: false,
        schedule: null,
        selectedInvestigations: new Map(),
        mergedEstimate: { ...EMPTY_COUNSELLING_ESTIMATE, finalPayableAmount: 53475 },
        savedSnapshot: {},
        isDoneState: false,
        existingOtScheduleId: null,
        onSuccess: () => undefined,
        invalidateWaitingList: () => undefined,
        invalidateSession: () => undefined,
      });

      const blob = JSON.parse(payload.packageAddonsJson as string);
      expect(blob.selectedIolId).toBe(selectedIolId);
      expect(restoreLensSelectionFromBlob(blob).selectedIolId).toBe(selectedIolId);
    }
  });

  it('includes selectedIolId in Azure packageDetails shape used by Save Draft', () => {
    const packageDetails = JSON.stringify({
      name: '',
      rate: 120000,
      paymentType: 'Cash',
      insuranceCompany: '',
      variantId: 'ff29c7ce-9d00-441b-9387-8f5235966e32',
      eye: 'RE',
      selectedIolId: 'iol-hoya',
      variantSubOption: undefined,
    });
    const parsed = JSON.parse(packageDetails);
    expect(parsed.selectedIolId).toBe('iol-hoya');
    expect(parsed.eye).toBe('RE');
    expect(parsed.variantId).toBe('ff29c7ce-9d00-441b-9387-8f5235966e32');
  });

  it('persists Hoya variantSubOption for sub-option procedures', () => {
    const { payload } = buildCounsellingSessionPayload({
      sessionId: 's1',
      session,
      selectedSurgeryId: 'type-var-edof-RE',
      selectedVariantId: 'var-edof',
      selectedEye: 'RE',
      selectedIolId: null,
      variantSubOption: 'Hoya',
      packageName: '',
      packageRate: '',
      paymentType: 'Cash',
      insuranceCompany: '',
      insuranceProviderId: undefined,
      freeSurgeryReason: '',
      decision: '',
      followUpReason: '',
      followUpDate: '',
      counsellorNotes: '',
      patientRemarks: '',
      doctorNotes: '',
      wantToSeeDoctor: false,
      interestedToUpgrade: false,
      notRequiredPreAuth: false,
      schedule: null,
      selectedInvestigations: new Map(),
      mergedEstimate: { ...EMPTY_COUNSELLING_ESTIMATE, finalPayableAmount: 53475 },
      savedSnapshot: {},
      isDoneState: false,
      existingOtScheduleId: null,
      onSuccess: () => undefined,
      invalidateWaitingList: () => undefined,
      invalidateSession: () => undefined,
    });

    const blob = JSON.parse(payload.packageAddonsJson as string);
    expect(blob.variantSubOption).toBe('Hoya');
    expect(restoreLensSelectionFromBlob(blob).variantSubOption).toBe('Hoya');
  });

  it('keeps lens fields when merging estimate into blob', () => {
    const merged = mergeEstimateIntoBlob(
      {
        variantId: 'var-1',
        variantSubOption: 'CT Lucia',
        selectedIolId: 'iol-2',
      },
      { finalPayableAmount: 1000 },
    );
    expect(merged.variantSubOption).toBe('CT Lucia');
    expect(merged.selectedIolId).toBe('iol-2');
  });
});
