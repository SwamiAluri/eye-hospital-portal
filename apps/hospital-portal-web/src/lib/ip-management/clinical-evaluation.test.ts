import { describe, expect, it } from 'vitest';
import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import {
  canSignOffEvaluation,
  getPreOpDiagnosisFromClearance,
  readClinicalEvaluationFields,
} from './clinical-evaluation';

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
  it('reads pre-op diagnosis from surgical_plan_confirmed.resultValue', () => {
    const completions = [
      completion('surgical_plan_confirmed', { resultValue: 'Immature cataract OD' }),
    ];
    expect(getPreOpDiagnosisFromClearance(completions)).toBe('Immature cataract OD');
    expect(readClinicalEvaluationFields(completions).diagnosis).toBe('Immature cataract OD');
  });

  it('requires all structured fields before sign-off', () => {
    expect(
      canSignOffEvaluation({
        diagnosis: 'Cataract OD',
        comorbidities: 'HTN',
        risk: 'Low',
        iolPlan: 'Monofocal',
        counsellingNotes: 'Discussed',
        surgicalPlanConfirmed: true,
        patientCounselled: true,
      }),
    ).toBe(true);

    expect(
      canSignOffEvaluation({
        diagnosis: '',
        comorbidities: 'HTN',
        risk: 'Low',
        iolPlan: '',
        counsellingNotes: '',
        surgicalPlanConfirmed: true,
        patientCounselled: true,
      }),
    ).toBe(false);
  });
});
