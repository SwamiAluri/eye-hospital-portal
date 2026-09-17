/**
 * Canonical document slot definitions shared between the counsellor Coverage/Pre-Auth flow
 * and the CCMS case documents workspace. Both surfaces upload to the same document store
 * using the same documentType keys, so files uploaded from counsellor desk appear in CCMS
 * and vice versa.
 */
import type { DocumentSlot } from '@/components/ccms/DocumentChecklist';
import { isPointerDocumentUrl } from '@/lib/ccms/case-document-preview';

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
  const known = ALL_DOC_SLOTS.find(s => s.key === key.toLowerCase());
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
      key: k,
      label: (r.documentName ?? '').trim() || labelForKnownKey(k),
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

type DocumentOnFile = { documentType?: string; isActive?: boolean };

export interface StoredCaseDocument {
  id: string;
  documentType?: string;
  url?: string;
  accessUrl?: string;
  uploadedAt?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  isActive?: boolean;
}

export function normalizeDocumentTypeKey(documentType?: string | null): string {
  return (documentType ?? '').trim().toLowerCase();
}

export function isActiveStoredDocument(doc: DocumentOnFile): boolean {
  return doc.isActive !== false && !!doc.documentType?.trim();
}

/** Excludes metadata-only rows (empty blob/size) from slot merge and progress counts. */
export function isCompleteStoredCaseDocument(doc: StoredCaseDocument): boolean {
  if (!doc.id?.trim() || !doc.documentType?.trim()) return false;
  const url = (doc.url ?? (doc as { blobUrl?: string }).blobUrl ?? '').trim();
  if (isPointerDocumentUrl(url)) return true;
  const size =
    (doc as { sizeBytes?: number }).sizeBytes ??
    (doc as { fileSizeBytes?: number }).fileSizeBytes;
  if (size !== undefined && size <= 0) return false;
  const access = doc.accessUrl?.trim() ?? '';
  if (!url && !access) return false;
  return url.startsWith('http') || access.startsWith('http');
}

export function documentTypesMatch(a?: string, b?: string): boolean {
  const left = normalizeDocumentTypeKey(a);
  const right = normalizeDocumentTypeKey(b);
  return !!left && left === right;
}

/** Latest active document for a slot key (case-insensitive), aligned with PreAuthDocumentGate. */
export function findActiveDocumentForSlot(
  docs: StoredCaseDocument[],
  slotKey: string,
): StoredCaseDocument | undefined {
  const target = normalizeDocumentTypeKey(slotKey);
  if (!target) return undefined;
  return docs.find(
    (d) => isActiveStoredDocument(d)
      && isCompleteStoredCaseDocument(d)
      && normalizeDocumentTypeKey(d.documentType) === target,
  );
}

export function resolveStoredDocumentPreviewUrl(doc: StoredCaseDocument): string | undefined {
  const access = doc.accessUrl?.trim();
  if (access) return access;
  const raw = doc.url?.trim();
  if (!raw) return undefined;
  if (isPointerDocumentUrl(raw)) return raw;
  return raw;
}

/** Map master slots to checklist rows using the shared document-to-slot matcher. */
export function mergeSlotsWithDocuments(
  slots: SlotDef[],
  docs: StoredCaseDocument[],
): DocumentSlot[] {
  return slots.map((slot) => {
    const doc = findActiveDocumentForSlot(docs, slot.key);
    const previewUrl = doc ? resolveStoredDocumentPreviewUrl(doc) : undefined;
    if (!previewUrl) {
      return {
        ...slot,
        uploadedUrl: undefined,
        uploadedAt: undefined,
        docId: undefined,
        fileName: undefined,
        mimeType: undefined,
      };
    }
    return {
      ...slot,
      uploadedUrl: previewUrl,
      uploadedAt: doc.uploadedAt,
      docId: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    };
  });
}

/** Optimistic cache merge — replace same documentType, keep all other uploads. */
export function upsertCaseDocumentInList<T extends StoredCaseDocument>(
  docs: T[] | undefined,
  uploaded: T,
): T[] {
  const key = normalizeDocumentTypeKey(uploaded.documentType);
  const list = docs ?? [];
  if (!key) return [uploaded, ...list];
  const withoutType = list.filter(
    (d) => normalizeDocumentTypeKey(d.documentType) !== key,
  );
  return [uploaded, ...withoutType];
}

export function removeCaseDocumentFromList<T extends { id: string }>(
  docs: T[] | undefined,
  docId: string,
): T[] {
  return (docs ?? []).filter((d) => d.id !== docId);
}

/**
 * Merge a fresh documents fetch with cached/optimistic rows.
 * Fetched wins per documentType; cached types missing from fetch are retained (stale-refetch guard).
 */
export function mergeFetchedWithCachedDocuments<T extends StoredCaseDocument>(
  cached: T[] | undefined,
  fetched: T[],
): T[] {
  const activeCached = (cached ?? []).filter((d) => d.isActive !== false && isCompleteStoredCaseDocument(d));
  const activeFetched = fetched.filter((d) => d.isActive !== false && isCompleteStoredCaseDocument(d));
  const byType = new Map<string, T>();

  for (const doc of activeCached) {
    const key = normalizeDocumentTypeKey(doc.documentType);
    if (key) byType.set(key, doc);
  }
  for (const doc of activeFetched) {
    const key = normalizeDocumentTypeKey(doc.documentType);
    if (key) byType.set(key, doc);
  }
  return [...byType.values()];
}

export function countRequiredFromRequirementRows(
  rows: DocumentRequirementRow[],
): number {
  return requiredDocumentSlots(requirementsToSlots(rows)).length;
}

export function requiredDocumentSlots(slots: SlotDef[]): SlotDef[] {
  return slots.filter((s) => s.required);
}

function activeDocumentTypes(docs: DocumentOnFile[]): Set<string> {
  return new Set(
    docs
      .filter((d) => isActiveStoredDocument(d))
      .map((d) => d.documentType!.trim().toLowerCase()),
  );
}

/** Active document types that have a persisted file (for slot merge / progress). */
function completeActiveDocumentTypes(docs: StoredCaseDocument[]): Set<string> {
  return new Set(
    docs
      .filter((d) => isActiveStoredDocument(d) && isCompleteStoredCaseDocument(d))
      .map((d) => normalizeDocumentTypeKey(d.documentType))
      .filter(Boolean),
  );
}

/**
 * Keep master requirement slots and add rows for uploaded document types not in the
 * current payer-scoped requirement set (e.g. after policy sync / submit).
 */
export function augmentSlotsWithUploadedDocuments(
  slots: SlotDef[],
  docs: StoredCaseDocument[],
): SlotDef[] {
  const seen = new Set(slots.map((s) => normalizeDocumentTypeKey(s.key)));
  const extra: SlotDef[] = [];
  for (const doc of docs) {
    if (!isActiveStoredDocument(doc)) continue;
    const key = normalizeDocumentTypeKey(doc.documentType);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    extra.push({
      key,
      label: (doc.fileName ?? '').trim() || labelForKnownKey(key),
      required: false,
      accept: 'image/*,application/pdf',
    });
  }
  return [...slots, ...extra];
}

/** Count of required master slots satisfied by active case documents (backend gate alignment). */
export function countUploadedRequiredDocuments(
  slots: SlotDef[],
  docs: DocumentOnFile[],
): number {
  const required = requiredDocumentSlots(slots);
  if (required.length === 0) return 0;
  const onFile = activeDocumentTypes(docs);
  return required.filter((s) => onFile.has(s.key.toLowerCase())).length;
}

/** Progress for UI display — only counts documents with persisted file metadata. */
export function countCompleteUploadedRequiredDocuments(
  slots: SlotDef[],
  docs: StoredCaseDocument[],
): number {
  const required = requiredDocumentSlots(slots);
  if (required.length === 0) return 0;
  const onFile = completeActiveDocumentTypes(docs);
  return required.filter((s) => onFile.has(s.key.toLowerCase())).length;
}

export function isDocumentsStepComplete(slots: SlotDef[], docs: DocumentOnFile[]): boolean {
  const required = requiredDocumentSlots(slots);
  if (required.length === 0) return true;
  return countUploadedRequiredDocuments(slots, docs) >= required.length;
}

export function isDocumentsStepCompleteForDisplay(
  slots: SlotDef[],
  docs: StoredCaseDocument[],
): boolean {
  const required = requiredDocumentSlots(slots);
  if (required.length === 0) return true;
  return countCompleteUploadedRequiredDocuments(slots, docs) >= required.length;
}

export function missingRequiredDocumentLabels(
  slots: SlotDef[],
  docs: DocumentOnFile[],
): string[] {
  const onFile = activeDocumentTypes(docs);
  return requiredDocumentSlots(slots)
    .filter((s) => !onFile.has(s.key.toLowerCase()))
    .map((s) => s.label);
}

/** Always show the OPD biometry pointer slot so Attach from OPD has a home. */
export function withBiometrySlot(slots: SlotDef[]): SlotDef[] {
  if (slots.some(s => s.key.toLowerCase() === 'biometry_record')) return slots;
  return [
    ...slots,
    { key: 'biometry_record', label: 'Biometry print', required: false, accept: '*' },
  ];
}

/**
 * Submit-to-claims gate copy — documents are required before claim/pre-auth packet submit.
 * Do not reuse for counselling Save/Finish messaging.
 */
export function formatMissingDocumentsMessage(
  missingLabels: string[],
  options?: { uploaded?: number; required?: number },
): string {
  const uploaded = options?.uploaded;
  const required = options?.required;
  if (
    typeof uploaded === 'number' &&
    typeof required === 'number' &&
    required > 0 &&
    missingLabels.length > 0
  ) {
    return `${uploaded}/${required} documents — upload required before submit`;
  }
  if (missingLabels.length === 0) {
    return 'Documents required before submit';
  }
  if (missingLabels.length === 1) {
    return `1 document missing — upload required before submit`;
  }
  return `${missingLabels.length} documents missing — upload required before submit`;
}

/**
 * Counselling / workspace display copy — operational readiness, not a session completion gate.
 */
export function formatOutstandingDocumentsMessage(
  outstandingCount: number,
  options?: { uploaded?: number; required?: number },
): string {
  const uploaded = options?.uploaded;
  const required = options?.required;
  if (
    typeof uploaded === 'number' &&
    typeof required === 'number' &&
    required > 0
  ) {
    const outstanding = Math.max(0, required - uploaded);
    if (outstanding === 0) {
      return `${uploaded} of ${required} required uploaded`;
    }
    if (outstanding === 1) {
      return `1 required document outstanding`;
    }
    return `${outstanding} required documents outstanding`;
  }
  if (outstandingCount <= 0) {
    return 'All required documents uploaded';
  }
  if (outstandingCount === 1) {
    return '1 required document outstanding';
  }
  return `${outstandingCount} required documents outstanding`;
}

/** Document Progress rail: "1 of 4 required" + "3 outstanding". */
export function formatDocumentProgressReadiness(
  uploaded: number,
  required: number,
): { primary: string; outstanding: string | null; complete: boolean } {
  if (required <= 0) {
    return { primary: 'No required documents', outstanding: null, complete: true };
  }
  const outstanding = Math.max(0, required - uploaded);
  return {
    primary: `${uploaded} of ${required} required`,
    outstanding: outstanding > 0 ? `${outstanding} outstanding` : null,
    complete: outstanding === 0,
  };
}

/** Soft CTA / submit readiness predicate shared by coverage panel. */
export function isRequiredDocumentUploadComplete(
  uploadedDocCount: number,
  requiredDocCount: number,
): boolean {
  return requiredDocCount === 0 || uploadedDocCount >= requiredDocCount;
}
