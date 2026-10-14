import { describe, expect, it } from 'vitest';
import {
  PATIENT_360_SECTIONS,
  isPatient360SectionKey,
  notIntegratedMessage,
  parsePatient360Section,
  unwiredPatient360Sections,
} from '@/lib/patients/patient-360-sections';

const FORBIDDEN = /no history|no documents|no counselling|no counseling|no bills|no records/i;

describe('patient 360 shell sections', () => {
  it('defines the seven target sections in order', () => {
    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
    expect(PATIENT_360_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Clinical',
      'Care',
      'Documents',
      'Coverage',
      'Administration',
      'Timeline',
    ]);
  });

  it('does not use the old record tab encyclopedia as section keys', () => {
    const keys = PATIENT_360_SECTIONS.map((section) => section.key);
    for (const hidden of ['vitals', 'counseling', 'billing', 'insurance', 'admissions', 'queue']) {
      expect(keys).not.toContain(hidden);
    }
  });

  it('parses the section query and defaults unknown values to overview', () => {
    expect(parsePatient360Section(null)).toBe('overview');
    expect(parsePatient360Section('care')).toBe('care');
    expect(parsePatient360Section('timeline')).toBe('timeline');
    expect(parsePatient360Section('vitals')).toBe('overview');
    expect(parsePatient360Section('billing')).toBe('overview');
    expect(isPatient360SectionKey('documents')).toBe(true);
    expect(isPatient360SectionKey('overview')).toBe(true);
    expect(isPatient360SectionKey('encounters')).toBe(false);
  });

  it('wires all seven sections, including Timeline aggregation from existing reads', () => {
    const wired = PATIENT_360_SECTIONS.filter((section) => !section.unwired).map((section) => section.key);
    expect(wired).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
    expect(unwiredPatient360Sections()).toEqual([]);
    expect(notIntegratedMessage('Timeline')).toMatch(/not available in Patient 360/i);
    expect(notIntegratedMessage('Timeline')).not.toMatch(FORBIDDEN);
  });
});
