import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HIDDEN_FROM_RECORD_SHELL } from '@/lib/patients/patient-record-tabs';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

const RECORD_EXAM_CALLERS = [
  'components/patients/tabs/MedHistoryTab.tsx',
  'components/patients/tabs/ExaminationsTab.tsx',
  'components/patients/tabs/DiagnosesTab.tsx',
  'components/patients/tabs/EyeHistoryTab.tsx',
] as const;

describe('examination getByPatient contract', () => {
  it('patient record callers use examinationApi.getByPatient(patientId)', () => {
    const client = readWeb('lib/api.ts');
    expect(client).toContain('getByPatient: (patientId: string) => getApi().get(`/examinations/patient/${patientId}`)');
    expect(client).not.toContain('getByPatientId');

    for (const file of RECORD_EXAM_CALLERS) {
      const source = readWeb(file);
      expect(source, file).toContain('examinationApi.getByPatient(patientId)');
      expect(source, file).not.toContain('getByPatientId');
    }
  });

  it('medical records still fail closed and keep the visits load', () => {
    const source = readWeb('components/patients/tabs/MedHistoryTab.tsx');
    expect(source).toContain('examinationApi.getByPatient(patientId).catch(() => ({ data: [] }))');
    expect(source).toContain('visitsApi.getByPatient(patientId).catch(() => ({ data: [] }))');
    expect(source).toContain('setLoading(true)');
    expect(source).toContain('Failed to load medical history.');
  });

  it('Slice 5 hidden tabs stay hidden after the call repair', () => {
    expect(HIDDEN_FROM_RECORD_SHELL).toEqual(
      expect.arrayContaining([
        'eye_history',
        'examinations',
        'diagnoses',
        'documents',
        'surgery',
        'admissions',
        'counseling',
        'preop',
        'procedures',
        'referrals',
        'feedback',
        'queue',
        'portal_access',
      ]),
    );
  });
});
