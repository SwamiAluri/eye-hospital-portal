import { describe, expect, it } from 'vitest';
import type { PacAssessmentDto } from '@/lib/api/ip-management.api';
import {
  computeMedHoldSignals,
  isMedHoldRowVisible,
  medHoldHintForRow,
  MED_HOLD_ROWS,
} from './preop-med-holds';

function pac(overrides: Partial<PacAssessmentDto> = {}): PacAssessmentDto {
  return {
    journeyId: 'j1',
    patientName: null,
    uhid: null,
    procedureName: null,
    eyeOperated: null,
    assessedAt: null,
    preOpDiagnosis: null,
    bp: null,
    hr: null,
    physicalStatusAsa: null,
    investigations: {},
    allergies: null,
    systemicReview: {},
    pastAnaestheticHistory: null,
    airwayExam: {},
    anaesthesiaPlan: null,
    periOpExplained: false,
    consentType: null,
    currentMedications: [],
    preOpConsultations: null,
    medicationsAdvised: null,
    investigationsAdvised: null,
    completedByDesignation: null,
    assessmentStatus: 'Draft',
    completedAt: null,
    isComplete: false,
    ...overrides,
  };
}

describe('preop-med-holds', () => {
  it('detects anticoagulant meds from PAC list', () => {
    const signals = computeMedHoldSignals(
      pac({
        currentMedications: [
          { name: 'Warfarin', dose: '5mg', frequency: 'OD' },
          { name: 'Timolol', dose: '0.5%', frequency: 'BD' },
        ],
      }),
    );
    expect(signals.showAnticoag).toBe(true);
    expect(signals.anticoagMeds).toHaveLength(1);
    expect(signals.anticoagMeds[0].name).toBe('Warfarin');
    expect(signals.showDiabetes).toBe(false);
  });

  it('detects diabetes from systemic review and med names', () => {
    const fromReview = computeMedHoldSignals(
      pac({ systemicReview: { diabetes: 'Type 2, on OHA' } }),
    );
    expect(fromReview.showDiabetes).toBe(true);
    expect(fromReview.diabetesDocumented).toBe(true);

    const fromMed = computeMedHoldSignals(
      pac({ currentMedications: [{ name: 'Metformin 500mg', dose: null, frequency: 'BD' }] }),
    );
    expect(fromMed.showDiabetes).toBe(true);
    expect(fromMed.diabetesMeds).toHaveLength(1);
  });

  it('hides conditional rows until PAC resolves unless already recorded', () => {
    const signals = computeMedHoldSignals(pac());
    const anticoagMeta = MED_HOLD_ROWS.find(r => r.key === 'anticoagulants_held')!;
    expect(
      isMedHoldRowVisible(anticoagMeta, {
        isCompleted: false,
        isBlocking: false,
        pacLoading: true,
        pacLoaded: false,
        signals,
      }),
    ).toBe(true);
    expect(
      isMedHoldRowVisible(anticoagMeta, {
        isCompleted: false,
        isBlocking: false,
        pacLoading: false,
        pacLoaded: true,
        signals,
      }),
    ).toBe(false);
    expect(
      isMedHoldRowVisible(anticoagMeta, {
        isCompleted: true,
        isBlocking: false,
        pacLoading: false,
        pacLoaded: true,
        signals,
      }),
    ).toBe(true);
  });

  it('builds row hints from PAC meds', () => {
    const signals = computeMedHoldSignals(
      pac({
        currentMedications: [
          { name: 'Clopidogrel', dose: '75mg', frequency: 'OD' },
          { name: 'Metformin', dose: '500mg', frequency: 'BD' },
        ],
      }),
    );
    expect(medHoldHintForRow('anticoagulants_held', signals)).toBe('Clopidogrel');
    expect(medHoldHintForRow('insulin_dose_managed', signals)).toBe('Metformin');
    expect(medHoldHintForRow('medication_adherence', signals)).toBe('Clopidogrel, Metformin');
  });
});
