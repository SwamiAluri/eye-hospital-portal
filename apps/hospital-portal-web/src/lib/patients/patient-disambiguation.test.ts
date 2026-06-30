import { describe, expect, it } from 'vitest';

import {
  formatPatientLookupName,
  formatPatientLookupSubtitle,
  formatPatientLookupTableSubline,
} from '@/lib/patients/patient-disambiguation';

describe('patient-disambiguation', () => {
  const sample = {
    firstName: 'Alex',
    lastName: 'Rivera',
    mrn: 'MRN-10042',
    dateOfBirth: '1985-03-12',
    gender: 'Male',
    phone: '+919876543210',
    email: 'alex@example.com',
  };

  it('formats full name', () => {
    expect(formatPatientLookupName(sample)).toBe('Alex Rivera');
  });

  it('formats autosuggest subtitle with full MRN and phone', () => {
    const subtitle = formatPatientLookupSubtitle(sample);
    expect(subtitle).toContain('MRN MRN-10042');
    expect(subtitle).toContain('Y');
    expect(subtitle).toContain('Male');
    expect(subtitle).toContain('DOB');
    expect(subtitle).toContain('+919876543210');
  });

  it('formats table subline without phone', () => {
    const subline = formatPatientLookupTableSubline(sample);
    expect(subline).toContain('MRN MRN-10042');
    expect(subline).not.toContain('+919876543210');
  });
});
