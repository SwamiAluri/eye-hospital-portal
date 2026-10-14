import { COUNSELLING_GENERIC_DOCUMENT_TYPES } from '@/lib/api/counseling-sessions.api';

export type Patient360DocumentAreaId =
  | 'general'
  | 'clinical'
  | 'counselling'
  | 'insurance'
  | 'laboratory'
  | 'imaging'
  | 'ipOt';

export interface Patient360DocumentAreaOption {
  id: Patient360DocumentAreaId;
  label: string;
  writable: boolean;
  unavailableHint?: string;
}

export interface Patient360DocumentTypeOption {
  id: string;
  label: string;
}

export const PATIENT_360_DOCUMENT_AREAS: Patient360DocumentAreaOption[] = [
  { id: 'general', label: 'General', writable: true },
  { id: 'clinical', label: 'Clinical', writable: false, unavailableHint: 'Unavailable' },
  { id: 'counselling', label: 'Counselling', writable: true },
  { id: 'insurance', label: 'Insurance', writable: false, unavailableHint: 'Unavailable' },
  { id: 'laboratory', label: 'Laboratory', writable: false, unavailableHint: 'Unavailable' },
  { id: 'imaging', label: 'Imaging', writable: false, unavailableHint: 'Unavailable' },
  { id: 'ipOt', label: 'IP / OT', writable: false, unavailableHint: 'Unavailable' },
];

/** Existing persisted General classification — keep as canonical "General Document". */
export const PATIENT_360_GENERAL_CLASSIFICATION = 'general';

/**
 * UI taxonomy mapped to canonical `classification` string values.
 * Counselling ids reuse certified counseling_session_documents vocabulary.
 * Other area ids are UI classification strings for future-ready selectors only.
 */
export const PATIENT_360_DOCUMENT_TYPES_BY_AREA: Record<
  Patient360DocumentAreaId,
  readonly Patient360DocumentTypeOption[]
> = {
  general: [
    { id: PATIENT_360_GENERAL_CLASSIFICATION, label: 'General Document' },
    { id: 'id_proof', label: 'ID Proof' },
    { id: 'address_proof', label: 'Address Proof' },
    { id: 'government_id', label: 'Government ID' },
    { id: 'referral_letter', label: 'Referral Letter' },
    { id: 'correspondence', label: 'Correspondence' },
    { id: 'administrative_document', label: 'Administrative Document' },
    { id: 'consent_declaration', label: 'Consent / Declaration' },
    { id: 'other', label: 'Other' },
  ],
  clinical: [
    { id: 'clinical_report', label: 'Clinical Report' },
    { id: 'consultation_report', label: 'Consultation Report' },
    { id: 'prescription', label: 'Prescription' },
    { id: 'clinical_note', label: 'Clinical Note' },
    { id: 'referral', label: 'Referral' },
    { id: 'medical_certificate', label: 'Medical Certificate' },
    { id: 'discharge_summary', label: 'Discharge Summary' },
    { id: 'other', label: 'Other' },
  ],
  counselling: COUNSELLING_GENERIC_DOCUMENT_TYPES.map((item) => ({
    id: item.id,
    label: item.label,
  })),
  insurance: [
    { id: 'insurance_card', label: 'Insurance Card' },
    { id: 'insurance_policy', label: 'Insurance Policy' },
    { id: 'pre_authorization', label: 'Pre-Authorization' },
    { id: 'coverage_document', label: 'Coverage Document' },
    { id: 'claim_document', label: 'Claim Document' },
    { id: 'approval_authorization', label: 'Approval / Authorization' },
    { id: 'rejection_query', label: 'Rejection / Query' },
    { id: 'other', label: 'Other' },
  ],
  laboratory: [
    { id: 'lab_report', label: 'Lab Report' },
    { id: 'pathology_report', label: 'Pathology Report' },
    { id: 'blood_test_report', label: 'Blood Test Report' },
    { id: 'biochemistry_report', label: 'Biochemistry Report' },
    { id: 'microbiology_report', label: 'Microbiology Report' },
    { id: 'other', label: 'Other' },
  ],
  imaging: [
    { id: 'imaging_report', label: 'Imaging Report' },
    { id: 'scan_report', label: 'Scan Report' },
    { id: 'x_ray', label: 'X-Ray' },
    { id: 'oct', label: 'OCT' },
    { id: 'fundus_imaging', label: 'Fundus Imaging' },
    { id: 'ultrasound', label: 'Ultrasound' },
    { id: 'other', label: 'Other' },
  ],
  ipOt: [
    { id: 'consent_form', label: 'Consent Form' },
    { id: 'lab_report', label: 'Lab Report' },
    { id: 'imaging_report', label: 'Imaging Report' },
    { id: 'insurance_card', label: 'Insurance Card' },
    { id: 'government_id', label: 'Government ID' },
    { id: 'fitness_certificate', label: 'Fitness Certificate' },
    { id: 'identity_proof', label: 'Identity Proof' },
    { id: 'pre_operative_document', label: 'Pre-Operative Document' },
    { id: 'surgical_document', label: 'Surgical Document' },
    { id: 'other', label: 'Other' },
  ],
};

/** @deprecated Prefer PATIENT_360_DOCUMENT_TYPES_BY_AREA.general */
export const PATIENT_360_GENERAL_CLASSIFICATIONS = PATIENT_360_DOCUMENT_TYPES_BY_AREA.general;

export function isWritablePatient360DocumentArea(id: Patient360DocumentAreaId): boolean {
  return PATIENT_360_DOCUMENT_AREAS.some((area) => area.id === id && area.writable);
}

export function documentAreaOptionLabel(area: Patient360DocumentAreaOption): string {
  return area.label;
}

export function patient360DocumentTypesForArea(
  areaId: Patient360DocumentAreaId,
): readonly Patient360DocumentTypeOption[] {
  return PATIENT_360_DOCUMENT_TYPES_BY_AREA[areaId] ?? PATIENT_360_DOCUMENT_TYPES_BY_AREA.general;
}

export function defaultPatient360DocumentTypeId(areaId: Patient360DocumentAreaId): string {
  return patient360DocumentTypesForArea(areaId)[0]?.id ?? PATIENT_360_GENERAL_CLASSIFICATION;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.values(PATIENT_360_DOCUMENT_TYPES_BY_AREA)
      .flat()
      .map((item) => [item.id.toLowerCase(), item.label]),
  ),
  general: 'General Document',
  preauth: 'Pre-Authorization',
  claim: 'Claim Document',
};

export function patient360DocumentTypeLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '—';
  return DOCUMENT_TYPE_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

export function patient360DocumentStatusLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '—';
  if (trimmed.toLowerCase() === 'active') return 'Active';
  if (trimmed.toLowerCase() === 'superseded') return 'Superseded';
  return trimmed;
}

export function areaHasDocumentTypeOther(areaId: Patient360DocumentAreaId): boolean {
  return patient360DocumentTypesForArea(areaId).some(
    (item) => item.id.toLowerCase() === 'other' || item.label === 'Other',
  );
}
