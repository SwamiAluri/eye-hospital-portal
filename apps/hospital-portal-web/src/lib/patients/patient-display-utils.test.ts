import { describe, expect, it } from 'vitest';
import type { Patient } from '@/lib/api/patients.api';
import {
  formatPatientDisplayName,
  formatPatientSex,
  getPatientInitials,
  unwrapPatientApiResponse,
} from '@/lib/patients/patient-display-utils';

describe('formatPatientDisplayName', () => {
  it('joins first and last name when both present', () => {
    expect(
      formatPatientDisplayName({ firstName: 'Meena', lastName: 'Iyer' }),
    ).toBe('Meena Iyer');
  });

  it('does not render undefined or null as text', () => {
    expect(
      formatPatientDisplayName({
        firstName: undefined as unknown as string,
        lastName: undefined as unknown as string,
      }),
    ).toBe('Patient');
    expect(
      formatPatientDisplayName({
        firstName: null as unknown as string,
        lastName: null as unknown as string,
      }),
    ).toBe('Patient');
  });

  it('uses fallback display name when first/last missing', () => {
    expect(
      formatPatientDisplayName(
        { firstName: '', lastName: '' },
        'FRESH Patient Nine',
      ),
    ).toBe('FRESH Patient Nine');
  });

  it('prefers patient name over fallback when available', () => {
    expect(
      formatPatientDisplayName(
        { firstName: 'Ravi', lastName: 'Kumar' },
        'Session Name',
      ),
    ).toBe('Ravi Kumar');
  });

  it('uses single available name part', () => {
    expect(formatPatientDisplayName({ firstName: 'Meena', lastName: '' })).toBe('Meena');
    expect(formatPatientDisplayName({ firstName: '', lastName: 'Iyer' })).toBe('Iyer');
  });

  it('prefers multi-word fallback when API only has a single name part', () => {
    expect(
      formatPatientDisplayName(
        { firstName: 'Balakrishna', lastName: '' },
        'Balakrishna Rao',
      ),
    ).toBe('Balakrishna Rao');
  });
});

describe('formatPatientSex', () => {
  it('normalizes lowercase and codes to human-readable labels', () => {
    expect(formatPatientSex('male')).toBe('Male');
    expect(formatPatientSex('FEMALE')).toBe('Female');
    expect(formatPatientSex('m')).toBe('Male');
    expect(formatPatientSex('f')).toBe('Female');
  });

  it('returns null for empty values', () => {
    expect(formatPatientSex(null)).toBeNull();
    expect(formatPatientSex('')).toBeNull();
    expect(formatPatientSex('   ')).toBeNull();
  });

  it('title-cases unknown sex labels', () => {
    expect(formatPatientSex('non-binary')).toBe('Non-Binary');
  });
});

describe('getPatientInitials', () => {
  it('uses first and last name initials', () => {
    expect(getPatientInitials('Balakrishna', 'Rao')).toBe('BR');
  });

  it('derives two initials from display name when parts missing', () => {
    expect(getPatientInitials(null, null, 'Balakrishna Rao')).toBe('BR');
    expect(getPatientInitials('Balakrishna', '', 'Balakrishna Rao')).toBe('BR');
  });

  it('falls back to a single initial when only one word exists', () => {
    expect(getPatientInitials('Balakrishna', null)).toBe('B');
    expect(getPatientInitials(null, null, 'Balakrishna')).toBe('B');
  });
});

describe('unwrapPatientApiResponse', () => {
  const patient = {
    id: 'p1',
    firstName: 'Meena',
    lastName: 'Iyer',
    medicalRecordNumber: 'MRN-1',
    dateOfBirth: '1980-01-01',
    gender: 'Female',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
  } satisfies Patient;

  it('unwraps Axios-style { data: Patient }', () => {
    expect(unwrapPatientApiResponse({ data: patient })).toEqual(patient);
  });

  it('returns Patient when already unwrapped', () => {
    expect(unwrapPatientApiResponse(patient)).toEqual(patient);
  });

  it('returns null for empty or invalid payloads', () => {
    expect(unwrapPatientApiResponse(null)).toBeNull();
    expect(unwrapPatientApiResponse(undefined)).toBeNull();
    expect(unwrapPatientApiResponse({ data: null })).toBeNull();
    expect(unwrapPatientApiResponse({})).toBeNull();
  });
});
