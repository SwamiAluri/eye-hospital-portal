import { describe, expect, it } from 'vitest';
import { buildSessionActionBarModel } from './counselling-session-actions';
import type { BuildSessionActionBarInput } from './counselling-session-actions';
import { validateSaveSessionDecision } from './counselling-progress';
import { buildJourneyRailStages } from './counselling-journey-rail';
import {
  isRequiredDocumentUploadComplete,
  missingRequiredDocumentLabels,
  formatMissingDocumentsMessage,
  requirementsToSlots,
} from '@/lib/ccms/ccms-document-slots';

const baseActionInput: BuildSessionActionBarInput = {
  queueStatus: 'Processed',
  activeMainTab: 'counselling',
  activePhase: 'wrapup',
  phaseCompletion: { estimate: true, decision: true, wrapup: true },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: 'DateForSurgery',
  paymentType: 'Insurance',
  insuranceCompany: 'Star Health',
  finalPayableAmount: 85000,
  showCoverageWorkflow: true,
  notRequiredPreAuth: false,
  coverageTabAvailable: true,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 4,
    ccmsState: 'POLICY_CAPTURED',
    preAuthSubmitted: false,
  },
  canAdvancePhase: true,
  phaseAdvanceError: null,
  saveDisabledReason: null,
  saveDraftDisabledReason: null,
  printDisabledReason: null,
  canSubmitToClaims: false,
  submittingToClaims: false,
};

const docMatrices = [
  [0, 4],
  [1, 4],
  [3, 4],
  [4, 4],
] as const;

describe('Phase 3F — insurance docs do not gate counselling completion', () => {
  it.each(docMatrices)(
    'Save Draft remains available with %i/%i required docs',
    (uploaded, required) => {
      const model = buildSessionActionBarModel({
        ...baseActionInput,
        coverageProgress: {
          ...baseActionInput.coverageProgress,
          uploadedDocCount: uploaded,
          requiredDocCount: required,
        },
      });
      expect(model.showSaveDraft).toBe(true);
      expect(model.saveDraftDisabledReason).toBeNull();
    },
  );

  it.each(docMatrices)(
    'Complete Session remains available on Notes with %i/%i required docs',
    (uploaded, required) => {
      const model = buildSessionActionBarModel({
        ...baseActionInput,
        coverageProgress: {
          ...baseActionInput.coverageProgress,
          uploadedDocCount: uploaded,
          requiredDocCount: required,
        },
      });
      expect(model.primary?.kind).toBe('save_session');
      expect(model.primary?.label).toBe('Complete Session');
      expect(model.primary?.disabledReason).toBeNull();
    },
  );

  it.each([
    [0, 4],
    [1, 4],
    [3, 4],
  ] as const)(
    'Insurance → Notes succeeds with %i/%i required docs outstanding',
    (uploaded, required) => {
      const model = buildSessionActionBarModel({
        ...baseActionInput,
        activeMainTab: 'coverage',
        activePhase: 'decision',
        phaseCompletion: { estimate: true, decision: true, wrapup: false },
        coverageProgress: {
          uploadedDocCount: uploaded,
          requiredDocCount: required,
          ccmsState: 'POLICY_CAPTURED',
          preAuthSubmitted: false,
        },
        canSubmitToClaims: false,
      });
      expect(model.primary?.kind).toBe('navigate');
      expect(model.primary?.label).toBe('Next: Notes');
      expect(model.primary?.navigateTab).toBe('counselling');
      expect(model.primary?.navigatePhase).toBe('wrapup');
    },
  );

  it('Complete Session decision validation ignores document completeness', () => {
    expect(
      validateSaveSessionDecision({
        selectedVariantId: 'v1',
        hasActiveTemplate: false,
        selectedIolId: null,
        variantSubOption: null,
        iolOptionCount: 0,
        paymentType: 'Insurance',
        insuranceCompany: 'Star Health',
        decision: 'DateForSurgery',
        schedule: {
          selectedDate: '2026-09-20',
          surgeryStartTime: '10:00',
          operationTheatre: 'OT1',
          doctor: 'Dr Test',
          avoidTimeFrom: '',
          avoidTimeTo: '',
        },
        followUpReason: '',
        followUpDate: '',
        counsellorNotes: '',
        patientRemarks: '',
        wantToSeeDoctor: false,
        interestedToUpgrade: false,
        notRequiredPreAuth: false,
      }),
    ).toBeNull();
  });

  it('journey rail Notes remains navigable with outstanding docs', () => {
    const stages = buildJourneyRailStages({
      activeMainTab: 'coverage',
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      showCoverageWorkflow: true,
      coverageTabAvailable: true,
      coverageProgress: {
        uploadedDocCount: 1,
        requiredDocCount: 4,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
      },
      queueStatus: 'Processed',
      isRepeatState: false,
      isSurgeryDoneState: false,
      canGoToPhase: () => true,
    });
    const notes = stages.find((s) => s.id === 'notes');
    expect(notes?.navigable).toBe(true);
  });
});

describe('Phase 3F — Submit to Claims document gate preserved', () => {
  const slots = requirementsToSlots([
    { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
    { documentType: 'insurance_card_front', documentName: 'Card Front', isRequired: true },
    { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
    { documentType: 'doctor_referral', documentName: 'Referral', isRequired: true },
  ]);

  it('blocks soft submit readiness when required docs are incomplete', () => {
    expect(isRequiredDocumentUploadComplete(0, 4)).toBe(false);
    expect(isRequiredDocumentUploadComplete(1, 4)).toBe(false);
    expect(isRequiredDocumentUploadComplete(3, 4)).toBe(false);
  });

  it('allows soft submit readiness when all required docs are uploaded', () => {
    expect(isRequiredDocumentUploadComplete(4, 4)).toBe(true);
  });

  it('hard gate still reports missing required document labels for submit abort', () => {
    const docs = [
      {
        id: '1',
        documentType: 'id_proof',
        isActive: true,
        url: 'http://127.0.0.1/a.pdf',
        sizeBytes: 100,
        mimeType: 'application/pdf',
      },
    ];
    const missing = missingRequiredDocumentLabels(slots, docs);
    expect(missing).toEqual(['Card Front', 'Policy', 'Referral']);
    expect(formatMissingDocumentsMessage(missing, { uploaded: 1, required: 4 })).toMatch(
      /upload required before submit/i,
    );
  });

  it('shows Submit to claims on Insurance when docs complete and canSubmit', () => {
    const model = buildSessionActionBarModel({
      ...baseActionInput,
      activeMainTab: 'coverage',
      canSubmitToClaims: true,
      coverageProgress: {
        uploadedDocCount: 4,
        requiredDocCount: 4,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
        canSubmitToClaims: true,
      },
    });
    expect(model.primary?.kind).toBe('submit_claims');
  });

  it('Phase 3G: Submit-to-Claims soft readiness stays gated when docs incomplete', () => {
    expect(isRequiredDocumentUploadComplete(2, 4)).toBe(false);
    expect(isRequiredDocumentUploadComplete(4, 4)).toBe(true);
  });
});
