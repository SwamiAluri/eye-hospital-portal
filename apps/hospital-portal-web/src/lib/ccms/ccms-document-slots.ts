/**
 * Canonical document slot definitions shared between the counsellor Coverage/Pre-Auth flow
 * and the CCMS case documents workspace. Both surfaces upload to the same document store
 * using the same documentType keys, so files uploaded from counsellor desk appear in CCMS
 * and vice versa.
 */
import type { DocumentSlot } from '@/components/ccms/DocumentChecklist';

export type CcmsDocumentKey =
  | 'id_proof'
  | 'insurance_card_front'
  | 'insurance_card_back'
  | 'policy_document'
  | 'doctor_referral'
  | 'preauth_form'
  | 'previous_claims'
  | 'authorization_letter'
  | 'discharge_summary'
  | 'investigation_reports'
  | 'clinical_notes'
  | 'bills'
  | 'other_1'
  | 'other_2';

/** Slots required for intake / pre-auth — used in counsellor Coverage tab and CCMS Overview. */
export const INTAKE_DOC_SLOTS: Omit<DocumentSlot, 'uploadedUrl' | 'uploadedAt' | 'docId'>[] = [
  { key: 'id_proof',             label: 'Patient ID Proof (Aadhaar / PAN / Passport)', required: true,  accept: 'image/*,application/pdf' },
  { key: 'insurance_card_front', label: 'Insurance Card — Front',                      required: true,  accept: 'image/*,application/pdf' },
  { key: 'insurance_card_back',  label: 'Insurance Card — Back',                       required: false, accept: 'image/*,application/pdf' },
  { key: 'policy_document',      label: 'Insurance Policy Copy',                       required: true,  accept: 'image/*,application/pdf' },
  { key: 'doctor_referral',      label: "Doctor's Referral / Prescription",            required: true,  accept: 'image/*,application/pdf' },
  { key: 'preauth_form',         label: 'Pre-Authorization Form',                      required: false, accept: 'image/*,application/pdf' },
  { key: 'previous_claims',      label: 'Previous Claim Documents',                    required: false, accept: 'image/*,application/pdf' },
  { key: 'other_1',              label: 'Other Document 1',                            required: false, accept: '*' },
  { key: 'other_2',              label: 'Other Document 2',                            required: false, accept: '*' },
];

/** Additional slots for the billing/claims phase — shown on the full CCMS documents page. */
export const CLAIMS_DOC_SLOTS: Omit<DocumentSlot, 'uploadedUrl' | 'uploadedAt' | 'docId'>[] = [
  { key: 'authorization_letter', label: 'Authorization Letter from TPA',               required: false, accept: 'image/*,application/pdf' },
  { key: 'bills',                label: 'Hospital Bills / Invoices',                   required: true,  accept: 'image/*,application/pdf' },
  { key: 'discharge_summary',    label: 'Discharge Summary',                           required: false, accept: 'image/*,application/pdf' },
  { key: 'investigation_reports',label: 'Investigation Reports',                       required: false, accept: 'image/*,application/pdf' },
  { key: 'clinical_notes',       label: 'Clinical Notes',                              required: false, accept: 'image/*,application/pdf' },
];

/** All slots combined — used on the full CCMS documents page. */
export const ALL_DOC_SLOTS = [...INTAKE_DOC_SLOTS, ...CLAIMS_DOC_SLOTS];
