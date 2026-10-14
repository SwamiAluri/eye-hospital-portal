import { describe, expect, it } from 'vitest';
import { mapLegacyRecordTabToPatient360Section } from '@/lib/patients/patient-360-legacy-tab';

describe('legacy Patient 360 ?tab= mapping', () => {
  it('maps only unambiguous owning-section relationships', () => {
    expect(mapLegacyRecordTabToPatient360Section('counseling')).toBe('care');
    expect(mapLegacyRecordTabToPatient360Section('insurance')).toBe('coverage');
    expect(mapLegacyRecordTabToPatient360Section('billing')).toBe('coverage');
    expect(mapLegacyRecordTabToPatient360Section('documents')).toBe('documents');
    expect(mapLegacyRecordTabToPatient360Section('scheduling')).toBe('care');
    expect(mapLegacyRecordTabToPatient360Section('visits')).toBe('care');
    expect(mapLegacyRecordTabToPatient360Section('lab_results')).toBe('clinical');
  });

  it('does not invent destinations for ambiguous tools tabs', () => {
    expect(mapLegacyRecordTabToPatient360Section('allergies')).toBeNull();
    expect(mapLegacyRecordTabToPatient360Section('vitals')).toBeNull();
    expect(mapLegacyRecordTabToPatient360Section('surgery')).toBeNull();
    expect(mapLegacyRecordTabToPatient360Section('overview')).toBeNull();
    expect(mapLegacyRecordTabToPatient360Section(null)).toBeNull();
    expect(mapLegacyRecordTabToPatient360Section('not-a-tab')).toBeNull();
  });
});
