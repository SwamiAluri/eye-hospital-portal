import { describe, expect, it } from 'vitest';
import {
  areaHasDocumentTypeOther,
  defaultPatient360DocumentTypeId,
  documentAreaOptionLabel,
  isWritablePatient360DocumentArea,
  PATIENT_360_DOCUMENT_AREAS,
  PATIENT_360_DOCUMENT_TYPES_BY_AREA,
  PATIENT_360_GENERAL_CLASSIFICATION,
  patient360DocumentStatusLabel,
  patient360DocumentTypeLabel,
  patient360DocumentTypesForArea,
  type Patient360DocumentAreaId,
} from '@/lib/patients/patient-360-document-areas';

const ALL_AREAS: Patient360DocumentAreaId[] = [
  'general',
  'clinical',
  'counselling',
  'insurance',
  'laboratory',
  'imaging',
  'ipOt',
];

describe('patient 360 document areas', () => {
  it('keeps General and Counselling writable; other hospital contexts unavailable', () => {
    expect(PATIENT_360_DOCUMENT_AREAS.map((area) => area.id)).toEqual(ALL_AREAS);
    expect(isWritablePatient360DocumentArea('general')).toBe(true);
    expect(isWritablePatient360DocumentArea('counselling')).toBe(true);
    expect(PATIENT_360_DOCUMENT_AREAS.filter((area) => !area.writable).map((area) => area.id)).toEqual([
      'clinical',
      'insurance',
      'laboratory',
      'imaging',
      'ipOt',
    ]);
    expect(documentAreaOptionLabel(PATIENT_360_DOCUMENT_AREAS[2])).toBe('Counselling');
    expect(PATIENT_360_DOCUMENT_AREAS[2]?.unavailableHint).toBeUndefined();
    expect(PATIENT_360_DOCUMENT_AREAS.some((area) => area.unavailableHint?.includes('Counselling workflow'))).toBe(
      false,
    );
    expect(patient360DocumentTypesForArea('counselling').map((item) => item.label)).toEqual([
      'Referral Letter',
      'Previous Report',
      'Insurance Card',
      'Policy Document',
      'ID Proof',
      'Address Proof',
      'Lab Report',
      'Imaging',
      'Other',
    ]);
    expect(PATIENT_360_GENERAL_CLASSIFICATION).toBe('general');
  });

  it('provides an Other type for every document area', () => {
    for (const area of ALL_AREAS) {
      expect(areaHasDocumentTypeOther(area)).toBe(true);
    }
  });

  it('keeps area-specific type lists and resets default type with the area', () => {
    expect(patient360DocumentTypesForArea('general').map((item) => item.label)).toEqual([
      'General Document',
      'ID Proof',
      'Address Proof',
      'Government ID',
      'Referral Letter',
      'Correspondence',
      'Administrative Document',
      'Consent / Declaration',
      'Other',
    ]);
    expect(patient360DocumentTypesForArea('counselling').map((item) => item.id)).toEqual([
      'ReferralLetter',
      'PreviousReport',
      'InsuranceCard',
      'PolicyDocument',
      'IDProof',
      'AddressProof',
      'LabReport',
      'Imaging',
      'Other',
    ]);
    expect(patient360DocumentTypesForArea('insurance').some((item) => item.label === 'Pre-Authorization')).toBe(true);
    expect(patient360DocumentTypesForArea('laboratory').some((item) => item.label === 'Lab Report')).toBe(true);
    expect(patient360DocumentTypesForArea('imaging').some((item) => item.label === 'OCT')).toBe(true);
    expect(patient360DocumentTypesForArea('ipOt').some((item) => item.label === 'Consent Form')).toBe(true);
    expect(patient360DocumentTypesForArea('clinical').some((item) => item.label === 'Discharge Summary')).toBe(true);
    expect(defaultPatient360DocumentTypeId('general')).toBe('general');
    expect(defaultPatient360DocumentTypeId('counselling')).toBe('ReferralLetter');
    expect(Object.keys(PATIENT_360_DOCUMENT_TYPES_BY_AREA)).toEqual(ALL_AREAS);
  });

  it('maps known document types for display without changing stored values', () => {
    expect(patient360DocumentTypeLabel('general')).toBe('General Document');
    expect(patient360DocumentTypeLabel('id_proof')).toBe('ID Proof');
    expect(patient360DocumentTypeLabel('ReferralLetter')).toBe('Referral Letter');
    expect(patient360DocumentTypeLabel('unknown_custom_type')).toBe('unknown_custom_type');
    expect(patient360DocumentTypeLabel(null)).toBe('—');
    expect(PATIENT_360_GENERAL_CLASSIFICATION).toBe('general');
  });

  it('maps known statuses for display', () => {
    expect(patient360DocumentStatusLabel('active')).toBe('Active');
    expect(patient360DocumentStatusLabel('superseded')).toBe('Superseded');
    expect(patient360DocumentStatusLabel('completed')).toBe('completed');
  });
});
