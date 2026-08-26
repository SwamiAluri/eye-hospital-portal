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
  | 'biometry_record'
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
  { key: 'biometry_record',      label: 'Biometry print',                              required: false, accept: '*' },
];

/** All slots combined — used as known-type labels only. Checklist source is master data. */
export const ALL_DOC_SLOTS = [...INTAKE_DOC_SLOTS, ...CLAIMS_DOC_SLOTS];

export interface DocumentRequirementRow {
  id?: string;
  documentType: string;
  documentName?: string;
  isRequired: boolean;
  appliesAt?: string;
  insuranceProviderId?: string | null;
  tpaProviderId?: string | null;
  governmentSchemeId?: string | null;
}

export type SlotDef = Omit<DocumentSlot, 'uploadedUrl' | 'uploadedAt' | 'docId'>;

/** Shown when master has no rows for this payer — optional uploads still allowed. */
export const OPTIONAL_FALLBACK_SLOTS: SlotDef[] = [
  { key: 'other_1', label: 'Other document', required: false, accept: '*' },
  { key: 'other_2', label: 'Other document 2', required: false, accept: '*' },
];

function labelForKnownKey(key: string): string {
  const known = ALL_DOC_SLOTS.find(s => s.key === key);
  if (known) return known.label;
  return key.replace(/_/g, ' ');
}

export function requirementsToSlots(rows: DocumentRequirementRow[]): SlotDef[] {
  const seen = new Set<string>();
  const slots: SlotDef[] = [];
  for (const r of rows) {
    const key = (r.documentType ?? '').trim();
    if (!key) continue;
    const k = key.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    slots.push({
      key,
      label: (r.documentName ?? '').trim() || labelForKnownKey(key),
      required: Boolean(r.isRequired),
      accept: 'image/*,application/pdf',
    });
  }
  return slots;
}

export function slotsFromMasterOrFallback(rows: DocumentRequirementRow[]): SlotDef[] {
  const slots = requirementsToSlots(rows);
  return slots.length > 0 ? slots : OPTIONAL_FALLBACK_SLOTS;
}

/** Always show the OPD biometry pointer slot so Attach from OPD has a home. */
export function withBiometrySlot(slots: SlotDef[]): SlotDef[] {
  if (slots.some(s => s.key.toLowerCase() === 'biometry_record')) return slots;
  return [
    ...slots,
    { key: 'biometry_record', label: 'Biometry print', required: false, accept: '*' },
  ];
}

export function formatMissingDocumentsMessage(missingLabels: string[]): string {
  if (missingLabels.length === 0) {
    return 'Pre-authorization cannot be sent until required documents are attached.';
  }
  if (missingLabels.length === 1) {
    return `Pre-authorization cannot be sent until ${missingLabels[0]} is attached.`;
  }
  const head = missingLabels.slice(0, -1).join(', ');
  return `Pre-authorization cannot be sent until ${head} and ${missingLabels[missingLabels.length - 1]} are attached.`;
}
