import { describe, expect, it } from 'vitest';
import {
  formatPatientCreateError,
  parseCreatePatientResponse,
} from '@/lib/patients/create-patient-response';

describe('parseCreatePatientResponse', () => {
  it('parses camelCase 201 body with id and MRN', () => {
    expect(
      parseCreatePatientResponse({
        id: 'p-1',
        medicalRecordNumber: 'MRN-2026-10-AAAA',
        firstName: 'Sam',
      }),
    ).toEqual({ id: 'p-1', medicalRecordNumber: 'MRN-2026-10-AAAA' });
  });

  it('parses PascalCase id / MedicalRecordNumber', () => {
    expect(
      parseCreatePatientResponse({
        Id: 'p-2',
        MedicalRecordNumber: 'MRN-2',
      }),
    ).toEqual({ id: 'p-2', medicalRecordNumber: 'MRN-2' });
  });

  it('accepts mrn alias when medicalRecordNumber absent', () => {
    expect(parseCreatePatientResponse({ id: 'p-3', mrn: 'MRN-3' })).toEqual({
      id: 'p-3',
      medicalRecordNumber: 'MRN-3',
    });
  });

  it('allows id without MRN (success UI must still open; MRN shown as unavailable)', () => {
    expect(parseCreatePatientResponse({ id: 'p-4' })).toEqual({
      id: 'p-4',
      medicalRecordNumber: null,
    });
  });

  it('throws when body empty or id missing', () => {
    expect(() => parseCreatePatientResponse(null)).toThrow(/empty or invalid/i);
    expect(() => parseCreatePatientResponse({})).toThrow(/patient id/i);
    expect(() => parseCreatePatientResponse({ medicalRecordNumber: 'MRN-X' })).toThrow(
      /patient id/i,
    );
  });
});

describe('formatPatientCreateError', () => {
  it('maps HTTP status codes to explicit messages', () => {
    expect(formatPatientCreateError({ response: { status: 400, data: {} } })).toMatch(
      /could not be created/i,
    );
    expect(
      formatPatientCreateError({
        response: { status: 400, data: { message: 'Validation failed' } },
      }),
    ).toBe('Validation failed');
    expect(formatPatientCreateError({ response: { status: 401 } })).toMatch(/session expired/i);
    expect(formatPatientCreateError({ response: { status: 403 } })).toMatch(/permission/i);
    expect(formatPatientCreateError({ response: { status: 409 } })).toMatch(/conflicts/i);
    expect(formatPatientCreateError({ response: { status: 500 } })).toMatch(/Server error/i);
  });

  it('uses Error.message for malformed response parse failures', () => {
    expect(
      formatPatientCreateError(new Error('Create patient response did not include patient id')),
    ).toMatch(/patient id/i);
  });
});
