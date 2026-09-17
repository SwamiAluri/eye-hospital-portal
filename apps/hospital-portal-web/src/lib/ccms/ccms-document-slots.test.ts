import { describe, expect, it } from 'vitest';
import {
  formatMissingDocumentsMessage,
  formatOutstandingDocumentsMessage,
  formatDocumentProgressReadiness,
  isRequiredDocumentUploadComplete,
  requirementsToSlots,
  slotsFromMasterOrFallback,
  withBiometrySlot,
  OPTIONAL_FALLBACK_SLOTS,
  countUploadedRequiredDocuments,
  countCompleteUploadedRequiredDocuments,
  augmentSlotsWithUploadedDocuments,
  isDocumentsStepComplete,
  missingRequiredDocumentLabels,
  requiredDocumentSlots,
  mergeSlotsWithDocuments,
  resolveStoredDocumentPreviewUrl,
  upsertCaseDocumentInList,
  removeCaseDocumentFromList,
  mergeFetchedWithCachedDocuments,
  countRequiredFromRequirementRows,
} from './ccms-document-slots';

describe('ccms document slots from master', () => {
  it('maps required and optional master rows', () => {
    const slots = requirementsToSlots([
      { documentType: 'surgeon_advice', documentName: 'Surgeon advice', isRequired: true },
      { documentType: 'oct_fundus', documentName: 'OCT / fundus', isRequired: false },
    ]);
    expect(slots).toEqual([
      { key: 'surgeon_advice', label: 'Surgeon advice', required: true, accept: 'image/*,application/pdf' },
      { key: 'oct_fundus', label: 'OCT / fundus', required: false, accept: 'image/*,application/pdf' },
    ]);
  });

  it('normalizes master documentType keys to lowercase', () => {
    const slots = requirementsToSlots([
      { documentType: 'ID_PROOF', documentName: 'Patient ID', isRequired: true },
    ]);
    expect(slots[0]?.key).toBe('id_proof');
  });

  it('falls back to optional uploads when master is empty', () => {
    expect(slotsFromMasterOrFallback([])).toEqual(OPTIONAL_FALLBACK_SLOTS);
    expect(slotsFromMasterOrFallback([]).every(s => !s.required)).toBe(true);
  });

  it('maps standard preauth intake master rows (migration 181 shape)', () => {
    const rows = [
      { documentType: 'id_proof', documentName: 'Patient ID Proof (Aadhaar / PAN / Passport)', isRequired: true },
      { documentType: 'insurance_card_front', documentName: 'Insurance Card — Front', isRequired: true },
      { documentType: 'insurance_card_back', documentName: 'Insurance Card — Back', isRequired: false },
      { documentType: 'policy_document', documentName: 'Insurance Policy Copy', isRequired: true },
      { documentType: 'doctor_referral', documentName: "Doctor's Referral / Prescription", isRequired: true },
    ];
    const slots = slotsFromMasterOrFallback(rows);
    expect(slots).toHaveLength(5);
    expect(countRequiredFromRequirementRows(rows)).toBe(4);
    expect(requiredDocumentSlots(slots).map((s) => s.key)).toEqual([
      'id_proof',
      'insurance_card_front',
      'policy_document',
      'doctor_referral',
    ]);
  });

  it('adds an optional biometry print slot when master omitted it', () => {
    const withBio = withBiometrySlot(OPTIONAL_FALLBACK_SLOTS);
    expect(withBio.some(s => s.key === 'biometry_record' && !s.required)).toBe(true);
    expect(withBiometrySlot(withBio)).toHaveLength(withBio.length);
  });

  it('formats the submit block copy (claims/pre-auth gate only)', () => {
    expect(formatMissingDocumentsMessage(['Surgeon advice'])).toBe(
      '1 document missing — upload required before submit',
    );
    expect(formatMissingDocumentsMessage(['Surgeon advice', 'Biometry print'])).toBe(
      '2 documents missing — upload required before submit',
    );
    expect(
      formatMissingDocumentsMessage(['Surgeon advice'], { uploaded: 3, required: 4 }),
    ).toBe('3/4 documents — upload required before submit');
  });

  it('formats outstanding readiness copy without implying counselling is blocked', () => {
    expect(formatOutstandingDocumentsMessage(3, { uploaded: 1, required: 4 })).toBe(
      '3 required documents outstanding',
    );
    expect(formatOutstandingDocumentsMessage(1, { uploaded: 3, required: 4 })).toBe(
      '1 required document outstanding',
    );
    expect(formatOutstandingDocumentsMessage(0, { uploaded: 4, required: 4 })).toBe(
      '4 of 4 required uploaded',
    );
    expect(formatOutstandingDocumentsMessage(3)).toBe('3 required documents outstanding');
    expect(formatOutstandingDocumentsMessage(3)).not.toMatch(/blocked|counselling|session/i);
  });

  it('formats Document Progress readiness for the insurance rail', () => {
    expect(formatDocumentProgressReadiness(1, 4)).toEqual({
      primary: '1 of 4 required',
      outstanding: '3 outstanding',
      complete: false,
    });
    expect(formatDocumentProgressReadiness(4, 4)).toEqual({
      primary: '4 of 4 required',
      outstanding: null,
      complete: true,
    });
    expect(formatDocumentProgressReadiness(0, 0)).toEqual({
      primary: 'No required documents',
      outstanding: null,
      complete: true,
    });
  });

  it('keeps submit readiness gated on required document completeness', () => {
    expect(isRequiredDocumentUploadComplete(0, 4)).toBe(false);
    expect(isRequiredDocumentUploadComplete(1, 4)).toBe(false);
    expect(isRequiredDocumentUploadComplete(3, 4)).toBe(false);
    expect(isRequiredDocumentUploadComplete(4, 4)).toBe(true);
    expect(isRequiredDocumentUploadComplete(0, 0)).toBe(true);
  });

  it('counts uploaded required documents against master slots', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
      { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
      { documentType: 'other_1', documentName: 'Other', isRequired: false },
    ]);
    const docs = [
      { id: '1', documentType: 'id_proof', isActive: true, url: 'http://127.0.0.1/x.pdf', sizeBytes: 100, mimeType: 'application/pdf' },
      { documentType: 'policy_document', isActive: false, url: 'http://127.0.0.1/y.pdf', sizeBytes: 100, mimeType: 'application/pdf' },
    ];
    expect(countUploadedRequiredDocuments(slots, docs)).toBe(1);
    expect(isDocumentsStepComplete(slots, docs)).toBe(false);
    expect(missingRequiredDocumentLabels(slots, docs)).toEqual(['Policy']);
  });

  it('treats documents step complete when master has no required rows', () => {
    const slots = slotsFromMasterOrFallback([]);
    expect(requiredDocumentSlots(slots).length).toBe(0);
    expect(isDocumentsStepComplete(slots, [])).toBe(true);
  });

  it('merges multiple uploaded documents onto slots simultaneously', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
      { documentType: 'insurance_card_front', documentName: 'Card Front', isRequired: true },
      { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
      { documentType: 'doctor_referral', documentName: 'Referral', isRequired: true },
    ]);
    const docs = [
      { id: '1', documentType: 'id_proof', url: 'https://a', uploadedAt: '2026-08-30', isActive: true },
      { id: '2', documentType: 'insurance_card_front', url: 'https://b', uploadedAt: '2026-08-30', isActive: true },
    ];
    const merged = mergeSlotsWithDocuments(slots, docs);
    expect(merged.filter((s) => s.uploadedUrl).map((s) => s.key)).toEqual([
      'id_proof',
      'insurance_card_front',
    ]);
    expect(countUploadedRequiredDocuments(slots, docs)).toBe(2);
  });

  it('matches stored documents to slots case-insensitively', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
    ]);
    const docs = [
      { id: '1', documentType: 'ID_PROOF', url: 'https://a', uploadedAt: '2026-08-30' },
    ];
    const merged = mergeSlotsWithDocuments(slots, docs);
    expect(merged[0]?.uploadedUrl).toBe('https://a');
    expect(countUploadedRequiredDocuments(slots, docs)).toBe(1);
  });

  it('upsert keeps prior uploads when a new document type is added', () => {
    const first = { id: '1', documentType: 'id_proof', url: 'https://a', isActive: true };
    const second = { id: '2', documentType: 'policy_document', url: 'https://b', isActive: true };
    const merged = upsertCaseDocumentInList([first], second);
    expect(merged).toHaveLength(2);
    expect(merged.map((d) => d.documentType).sort()).toEqual(['id_proof', 'policy_document']);
  });

  it('upsert replaces only the same document type on replace upload', () => {
    const first = { id: '1', documentType: 'id_proof', url: 'https://old', isActive: true };
    const replacement = { id: '2', documentType: 'ID_PROOF', url: 'https://new', isActive: true };
    const other = { id: '3', documentType: 'policy_document', url: 'https://p', isActive: true };
    const merged = upsertCaseDocumentInList([first, other], replacement);
    expect(merged).toHaveLength(2);
    expect(merged.find((d) => d.documentType?.toLowerCase() === 'id_proof')?.url).toBe('https://new');
    expect(merged.find((d) => d.documentType === 'policy_document')?.url).toBe('https://p');
  });

  it('merges fileName and mimeType onto uploaded slots', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
    ]);
    const docs = [
      {
        id: 'doc-1',
        documentType: 'id_proof',
        url: 'https://blob/aadhaar.pdf',
        uploadedAt: '2026-08-30T10:00:00Z',
        fileName: 'Aadhaar.pdf',
        mimeType: 'application/pdf',
        isActive: true,
      },
    ];
    const merged = mergeSlotsWithDocuments(slots, docs);
    expect(merged[0]).toMatchObject({
      uploadedUrl: 'https://blob/aadhaar.pdf',
      uploadedAt: '2026-08-30T10:00:00Z',
      docId: 'doc-1',
      fileName: 'Aadhaar.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('counts required rows from master requirements', () => {
    const rows = [
      { documentType: 'id_proof', documentName: 'ID', isRequired: true },
      { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
      { documentType: 'other_1', documentName: 'Other', isRequired: false },
    ];
    expect(countRequiredFromRequirementRows(rows)).toBe(2);
  });

  it('merges fallback other_1 upload with stale fetch', () => {
    const cached = [
      {
        id: '1',
        documentType: 'other_1',
        url: 'https://new',
        fileName: 'scan.pdf',
        mimeType: 'application/pdf',
        isActive: true,
      },
    ];
    const fetched: typeof cached = [];
    const merged = mergeFetchedWithCachedDocuments(cached, fetched);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.documentType).toBe('other_1');

    const slots = slotsFromMasterOrFallback([]);
    const rowState = mergeSlotsWithDocuments(slots, merged);
    expect(rowState.find((s) => s.key === 'other_1')?.uploadedUrl).toBe('https://new');
    expect(rowState.find((s) => s.key === 'other_1')?.fileName).toBe('scan.pdf');
  });

  it('mergeFetchedWithCachedDocuments keeps A when fetch only returns B', () => {
    const cached = [
      { id: '1', documentType: 'id_proof', url: 'https://a', isActive: true },
      { id: '2', documentType: 'other_1', url: 'https://b', isActive: true },
    ];
    const fetched = [{ id: '3', documentType: 'policy_document', url: 'https://p', isActive: true }];
    const merged = mergeFetchedWithCachedDocuments(cached, fetched);
    expect(merged.map((d) => d.documentType).sort()).toEqual(['id_proof', 'other_1', 'policy_document']);
  });

  it('prefers accessUrl over raw blob url for preview slots', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
    ]);
    const docs = [
      {
        id: '1',
        documentType: 'id_proof',
        url: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf',
        accessUrl: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf?sig=abc',
        isActive: true,
      },
    ];
    const merged = mergeSlotsWithDocuments(slots, docs);
    expect(merged[0]?.uploadedUrl).toContain('sig=abc');
    expect(resolveStoredDocumentPreviewUrl(docs[0]!)).toContain('sig=abc');
  });

  it('clears metadata when document is removed from merge input', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
      { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
    ]);
    const docs = [
      {
        id: '1',
        documentType: 'id_proof',
        url: 'https://a',
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        isActive: true,
      },
    ];
    const merged = mergeSlotsWithDocuments(slots, docs);
    expect(merged.find((s) => s.key === 'policy_document')?.fileName).toBeUndefined();
    expect(merged.find((s) => s.key === 'id_proof')?.fileName).toBe('a.pdf');
  });

  it('removeCaseDocumentFromList decreases required count without touching other types', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
      { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
    ]);
    const docs = [
      { id: '1', documentType: 'id_proof', isActive: true, url: 'http://127.0.0.1/a.pdf', sizeBytes: 100, mimeType: 'application/pdf' },
      { id: '2', documentType: 'policy_document', isActive: true, url: 'http://127.0.0.1/b.pdf', sizeBytes: 200, mimeType: 'application/pdf' },
    ];
    expect(countCompleteUploadedRequiredDocuments(slots, docs)).toBe(2);
    const afterDelete = removeCaseDocumentFromList(docs, '1');
    expect(countCompleteUploadedRequiredDocuments(slots, afterDelete)).toBe(1);
    expect(isDocumentsStepComplete(slots, afterDelete)).toBe(false);
  });

  it('augmentSlotsWithUploadedDocuments adds slots for uploaded types missing from master', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
    ]);
    const docs = [
      {
        id: '1',
        documentType: 'doctor_referral',
        url: 'http://127.0.0.1/x.pdf',
        sizeBytes: 100,
        mimeType: 'application/pdf',
        isActive: true,
      },
    ];
    const augmented = augmentSlotsWithUploadedDocuments(slots, docs);
    expect(augmented.some((s) => s.key === 'doctor_referral')).toBe(true);
    const merged = mergeSlotsWithDocuments(augmented, docs);
    expect(merged.find((s) => s.key === 'doctor_referral')?.uploadedUrl).toBeTruthy();
  });

  it('mergeFetchedWithCachedDocuments retains cached uploads when fetch returns empty', () => {
    const cached = [
      {
        id: '1',
        documentType: 'id_proof',
        url: 'http://127.0.0.1/a.pdf',
        sizeBytes: 100,
        mimeType: 'application/pdf',
        isActive: true,
      },
    ];
    const merged = mergeFetchedWithCachedDocuments(cached, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('1');
  });

  it('hydrates workspace entity documents into populated slots after refresh', () => {
    const slots = requirementsToSlots([
      { documentType: 'id_proof', documentName: 'ID Proof', isRequired: true },
      { documentType: 'policy_document', documentName: 'Policy', isRequired: true },
    ]);
    const workspaceEntityDocs = [
      {
        id: 'persisted-1',
        coverageCase_Id: 'case-uuid',
        documentType: 'id_proof',
        documentName: 'aadhaar.pdf',
        blobUrl: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/aadhaar.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1500,
        uploadedAt: '2026-08-31T10:00:00Z',
        status: 'active',
      },
    ];
    const normalized = workspaceEntityDocs.map((row) => ({
      id: row.id,
      caseId: row.coverageCase_Id,
      documentType: row.documentType,
      fileName: row.documentName,
      url: row.blobUrl,
      mimeType: row.mimeType,
      sizeBytes: row.fileSizeBytes,
      uploadedAt: row.uploadedAt,
      isActive: true,
    }));
    const merged = mergeSlotsWithDocuments(slots, normalized);
    expect(merged.find((s) => s.key === 'id_proof')?.uploadedUrl).toContain('aadhaar.pdf');
    expect(countCompleteUploadedRequiredDocuments(slots, normalized)).toBe(1);
  });
});
