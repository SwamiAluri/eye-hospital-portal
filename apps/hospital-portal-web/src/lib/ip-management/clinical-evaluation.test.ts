import { describe, expect, it } from 'vitest';
import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import {
  canAmendClinicalEvaluation,
  canSignOffEvaluation,
  countEvaluationReadiness,
  formatComorbiditySummary,
  formatIolPlanSummary,
  getPreOpDiagnosisFromClearance,
  hasIolPlanContent,
  isComorbidityReviewComplete,
  isIolCataractProcedure,
  parseComorbidityNotes,
  readClinicalEvaluationFields,
  serializeStructuredPayload,
  buildStructuredPayload,
} from './clinical-evaluation';
import { buildSurgicalPlanCompletionPatch } from './clinical-evaluation-persist';

function completion(key: string, patch: Partial<PreOpCompletionDto> = {}): PreOpCompletionDto {
  return {
    id: key,
    clearanceId: 'c1',
    itemId: key,
    itemKey: key,
    itemLabel: key,
    category: 'Evaluation',
    isBlocking: false,
    requiresDocument: false,
    isCompleted: false,
    isBypassed: false,
    bypassReason: null,
    notes: null,
    documentId: null,
    completedByUserId: null,
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...patch,
  };
}

describe('clinical-evaluation helpers', () => {
  it('reads pre-op diagnosis from surgical_plan_confirmed notes JSON', () => {
    const payload = buildStructuredPayload({
      diagnoses: [{ icd10: 'H25.1', description: 'Immature cataract', isPrimary: true, laterality: 'OD' }],
      diagnosisStatus: 'confirmed',
      sourceDiagnosis: null,
      diagnosisOverrideReason: '',
      iol: { counsellingIolId: null, wardIolId: null, power: '', toricAxis: '', status: 'pending', changeReason: '' },
      comorbidities: { nad: true, items: {}, other: '' },
      clinicalNote: '',
      surgicalPlanConfirmed: true,
      patientCounselled: true,
      diagnosisSummary: 'H25.1 — Immature cataract (OD)',
    });
    const completions = [
      completion('surgical_plan_confirmed', {
        resultValue: 'H25.1 — Immature cataract (OD)',
        notes: serializeStructuredPayload(payload),
        resultUnit: null,
      }),
    ];
    expect(getPreOpDiagnosisFromClearance(completions)).toBe('H25.1 — Immature cataract (OD)');
  });

  it('still reads structured payload from legacy resultUnit column', () => {
    const payload = buildStructuredPayload({
      diagnoses: [{ icd10: 'H40.11', description: 'Glaucoma', isPrimary: true }],
      diagnosisStatus: 'pending',
      sourceDiagnosis: null,
      diagnosisOverrideReason: '',
      iol: { counsellingIolId: null, wardIolId: null, power: '', toricAxis: '', status: 'pending', changeReason: '' },
      comorbidities: { nad: true, items: {}, other: '' },
      clinicalNote: '',
      surgicalPlanConfirmed: false,
      patientCounselled: false,
      diagnosisSummary: '',
    });
    const completions = [
      completion('surgical_plan_confirmed', {
        resultValue: 'H40.11 — Glaucoma',
        resultUnit: serializeStructuredPayload(payload),
        notes: null,
      }),
    ];
    expect(readClinicalEvaluationFields(completions).diagnoses[0]?.icd10).toBe('H40.11');
  });

  it('persists structured eval in notes not resultUnit', () => {
    const fields = {
      diagnoses: [{ icd10: 'H25.012', description: 'Cortical cataract, left eye', isPrimary: true, laterality: 'OU' as const }],
      diagnosisStatus: 'pending' as const,
      sourceDiagnosis: null,
      diagnosisOverrideReason: '',
      iol: { counsellingIolId: null, wardIolId: null, power: '', toricAxis: '', status: 'pending' as const, changeReason: '' },
      comorbidities: { nad: true, items: {}, other: '' },
      clinicalNote: '',
      surgicalPlanConfirmed: false,
      patientCounselled: false,
      diagnosisSummary: '',
    };
    const patch = buildSurgicalPlanCompletionPatch(fields, completion('surgical_plan_confirmed'));
    expect(patch.resultUnit).toBeNull();
    expect(patch.notes).toContain('"icd10":"H25.012"');
    expect(patch.resultValue).toContain('H25.012');
  });

  it('requires structured fields before sign-off', () => {
    expect(
      canSignOffEvaluation({
        diagnoses: [{ icd10: 'H25.1', description: 'Cataract OD', isPrimary: true }],
        diagnosisStatus: 'confirmed',
        sourceDiagnosis: null,
        diagnosisOverrideReason: '',
        comorbidities: { nad: false, items: { hypertension: true }, other: '' },
        iol: { counsellingIolId: 'i1', wardIolId: 'i1', power: '+21', toricAxis: '', status: 'confirmed', changeReason: '' },
        clinicalNote: '',
        surgicalPlanConfirmed: true,
        patientCounselled: true,
        diagnosisSummary: 'Cataract OD',
      }),
    ).toBe(true);

    expect(
      canSignOffEvaluation({
        diagnoses: [],
        diagnosisStatus: 'pending',
        sourceDiagnosis: null,
        diagnosisOverrideReason: '',
        comorbidities: { nad: false, items: { hypertension: true }, other: '' },
        iol: { counsellingIolId: null, wardIolId: null, power: '', toricAxis: '', status: 'pending', changeReason: '' },
        clinicalNote: '',
        surgicalPlanConfirmed: true,
        patientCounselled: true,
        diagnosisSummary: '',
      }),
    ).toBe(false);
  });

  it('parses comorbidity NAD and checklist JSON', () => {
    expect(parseComorbidityNotes('NAD').nad).toBe(true);
    const structured = parseComorbidityNotes(
      JSON.stringify({ v: 1, nad: false, items: { diabetes: true }, other: '' }),
    );
    expect(isComorbidityReviewComplete(structured)).toBe(true);
    expect(formatComorbiditySummary(structured)).toContain('Diabetes');
  });

  it('excludes retired risk and duplicate sign-off from readiness count', () => {
    const completions = [
      completion('risk_classification', { isCompleted: true, isBlocking: true }),
      completion('doctor_evaluation_completed', { isCompleted: true, isBlocking: true }),
      completion('doctor_evaluation_signed', { isCompleted: false, isBlocking: true }),
      completion('comorbidities_reviewed', { isCompleted: true, isBlocking: true }),
      completion('surgical_plan_confirmed', { isCompleted: false, isBlocking: true }),
      completion('patient_counselled', { isCompleted: false, isBlocking: true }),
    ];
    expect(countEvaluationReadiness(completions)).toEqual({ completed: 1, total: 4, blocking: 3 });
  });

  it('detects IOL procedures but not LASIK', () => {
    expect(isIolCataractProcedure('Phacoemulsification with IOL')).toBe(true);
    expect(isIolCataractProcedure('LASIK bilateral')).toBe(false);
  });

  it('gates amend by clinical state and sign-off', () => {
    expect(
      canAmendClinicalEvaluation({
        clinicalState: 'ReadyForSurgery',
        signedOff: true,
        canSign: true,
      }).allowed,
    ).toBe(true);

    expect(
      canAmendClinicalEvaluation({
        clinicalState: 'SentToOT',
        signedOff: true,
        canSign: true,
      }).allowed,
    ).toBe(false);

    expect(
      canAmendClinicalEvaluation({
        clinicalState: 'InOT',
        signedOff: true,
        canSign: true,
        canAmendInOt: true,
      }).kind,
    ).toBe('in_ot');
  });

  it('reads legacy plain-text fields', () => {
    const fields = readClinicalEvaluationFields([
      completion('surgical_plan_confirmed', { resultValue: 'Cataract OD', isCompleted: true }),
      completion('comorbidities_reviewed', { notes: 'HTN' }),
    ]);
    expect(fields.diagnosisSummary).toBe('Cataract OD');
    expect(fields.diagnosisStatus).toBe('confirmed');
    expect(fields.comorbidities.other).toBe('HTN');
  });

  it('formats IOL summary for signed view', () => {
    expect(formatIolPlanSummary({
      counsellingIolId: null,
      wardIolId: null,
      power: '',
      toricAxis: '',
      status: 'pending',
      changeReason: '',
    })).toBe('Not recorded');

    expect(formatIolPlanSummary({
      counsellingIolId: 'c1',
      wardIolId: 'w1',
      power: '+21.0',
      toricAxis: '90',
      status: 'confirmed',
      changeReason: '',
    }, 'AcrySof IQ')).toContain('AcrySof IQ');
    expect(formatIolPlanSummary({
      counsellingIolId: 'c1',
      wardIolId: 'w1',
      power: '+21.0',
      toricAxis: '90',
      status: 'confirmed',
      changeReason: '',
    }, 'AcrySof IQ')).toContain('toric axis 90°');

    expect(hasIolPlanContent({
      counsellingIolId: null,
      wardIolId: null,
      power: '+21',
      toricAxis: '',
      status: 'pending',
      changeReason: '',
    })).toBe(true);
  });
});
