import { describe, expect, it } from 'vitest';
import type { PacAssessmentDto } from '@/lib/api/ip-management.api';
import { buildAnaesthesiaClearanceRows } from './pac-anaesthesia-clearance';

function basePac(overrides: Partial<PacAssessmentDto> = {}): PacAssessmentDto {
  return {
    journeyId: 'j1',
    patientName: null,
    uhid: null,
    procedureName: null,
    eyeOperated: null,
    assessedAt: null,
    preOpDiagnosis: null,
    bp: '120/80',
    hr: 72,
    physicalStatusAsa: 2,
    investigations: {},
    allergies: 'NAD',
    systemicReview: { cvs: 'NAD', respiratory: 'NAD' },
    pastAnaestheticHistory: null,
    airwayExam: { mallampati: 2 },
    anaesthesiaPlan: 'Local',
    periOpExplained: true,
    consentType: 'Written',
    currentMedications: [],
    preOpConsultations: null,
    medicationsAdvised: null,
    investigationsAdvised: null,
    completedByDesignation: null,
    assessmentStatus: 'Completed',
    completedAt: '2026-07-02T10:00:00.000Z',
    isComplete: true,
    ...overrides,
  };
}

describe('pac-anaesthesia-clearance', () => {
  it('builds parameter rows from PAC and journey anaesthetist', () => {
    const rows = buildAnaesthesiaClearanceRows(basePac(), 'Dr Rao');
    expect(rows.find(r => r.parameter === 'ASA Physical Status')?.value).toBe('ASA 2');
    expect(rows.find(r => r.parameter === 'Anaesthesia Type')?.value).toBe('Local');
    expect(rows.find(r => r.parameter === 'Anaesthetist')?.value).toBe('Dr Rao');
    expect(rows.find(r => r.parameter === 'Airway (Mallampati)')?.value).toBe('Class II');
    expect(rows.find(r => r.parameter === 'Fitness')?.value).toContain('Cleared');
  });

  it('uses dash for empty values', () => {
    const rows = buildAnaesthesiaClearanceRows(
      basePac({ anaesthesiaPlan: '', assessmentStatus: 'Draft', completedAt: null }),
      null,
    );
    expect(rows.find(r => r.parameter === 'Anaesthesia Type')?.value).toBe('—');
    expect(rows.find(r => r.parameter === 'Anaesthetist')?.value).toBe('—');
    expect(rows.find(r => r.parameter === 'Fitness')?.value).toBe('—');
  });
});
