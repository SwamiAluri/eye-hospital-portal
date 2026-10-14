import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360DocumentsView } from '@/components/patients/record/Patient360Documents';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';

const letter = {
  id: 'd1',
  coverageCaseId: 'case-1',
  documentName: 'letter.pdf',
  documentType: 'clinical_note',
  documentCategory: 'preauth',
  status: 'active',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-02',
  uploadedAt: '2026-09-01',
  mimeType: 'application/pdf',
  fileSizeBytes: '2048 bytes',
  canonicalDocumentId: null as string | null,
  isPointer: false,
};

const photo = {
  ...letter,
  id: 'd2',
  documentName: 'photo.pdf',
  documentCategory: 'claim',
  status: 'active',
};

describe('patient 360 documents presentation', () => {
  it('renders metadata for a successful read and keeps documents separate', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="documents" onSelect={() => undefined} />
        <Patient360DocumentsView documents={{ state: 'ready', rows: [letter, photo] }} />
      </>,
    );

    expect(html).toContain('>Documents<');
    expect(html).toContain('Source: CCMS Documents');
    expect(html).toContain('not the complete hospital document record');
    expect(html).toContain('letter.pdf');
    expect(html).toContain('photo.pdf');
    expect(html).toContain('Clinical Note');
    expect(html).toContain('Pre-Authorization');
    expect(html).toContain('Claim Document');
    expect(html).toContain('Preview');
    expect(html).not.toContain('View details');
    expect(html).toContain('01 Sep 2026');
    expect(html).toContain('aria-label="Document sources"');
    expect(html).not.toContain('role="tablist" aria-label="Document');
    expect(html).toContain('Active');
    expect(html).toContain('<table');
    expect(html).toContain('>Document<');
    expect(html).toContain('>Type<');
    expect(html).toContain('>Source<');
    expect(html).toContain('>Date / Time<');
    expect(html).toContain('>Status<');
    expect(html).toContain('>Action<');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    const view = renderToStaticMarkup(
      <Patient360DocumentsView documents={{ state: 'ready', rows: [letter, photo] }} />,
    );
    expect(view).toContain('<button');
    expect(view).not.toMatch(/\b(Upload|Delete|Approve|Download|accessUrl|blobUrl)\b/i);
  });

  it('shows the CCMS empty sentence only on a dedicated empty All index after sources resolve', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        generalDocuments={{ state: 'ready', rows: [] }}
      />,
    );
    expect(html).toContain('No documents recorded.');
    expect(html).toContain('<th');
    expect(html).toContain('colSpan=');
    expect(html).not.toContain('No CCMS documents recorded.');
    expect(html).not.toContain('Laboratory reports are not available in Patient 360.');
    expect(html).not.toContain('Insurance documents are not available in Patient 360.');
    expect(html).not.toMatch(/<p[^>]*>No documents recorded\./);
  });

  it('dedupes the same canonical identity on All across General and Counselling', () => {
    const sharedId = 'canon-shared-1';
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        generalDocuments={{
          state: 'ready',
          rows: [
            {
              id: sharedId,
              patientId: 'p1',
              fileName: 'policy.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 12,
              classification: 'policy',
              status: 'active',
              createdAt: '2026-09-01T10:00:00Z',
              createdByUserId: 'u1',
              supersededByDocumentId: null,
            },
          ],
        }}
        counsellingDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'counsel-row-1',
              sessionId: null,
              documentName: 'policy.pdf',
              documentType: 'PolicyDocument',
              status: 'active',
              createdAt: '2026-09-01T10:00:00Z',
              updatedAt: '2026-09-01T10:00:00Z',
              createdByUserId: 'u1',
              canonicalDocumentId: sharedId,
              fileType: 'pdf',
            },
          ],
        }}
        canDownload
        canReadCounsellingDocuments
      />,
    );
    expect(html.match(/>policy\.pdf</g)?.length ?? 0).toBe(1);
    expect(html).toContain('>General Patient Documents<');
    expect(html).not.toContain('>Counselling Documents</td>');
  });

  it('does not turn an unauthorized read into empty history', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView documents={{ state: 'unauthorized', rows: [] }} initialFilter="all" />,
    );
    expect(html).toContain('Loading general patient documents.');
    expect(html).not.toContain('No CCMS documents recorded.');
  });

  it('shows an unavailable state for a failed read', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'unavailable', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        generalDocuments={{ state: 'ready', rows: [] }}
      />,
    );
    expect(html).toContain('No documents recorded.');
    expect(html).not.toContain('No CCMS documents recorded.');
  });

  it('shows a loading state before the read returns', () => {
    const html = renderToStaticMarkup(<Patient360DocumentsView documents={null} counsellingDocuments={null} />);
    expect(html).toContain('Loading documents.');
    expect(html).toContain('Loading counselling documents.');
    expect(html).toContain('Loading general patient documents.');
    expect(html).not.toContain('No CCMS documents recorded.');
    expect(html).not.toContain('No counselling documents recorded.');
  });

  it('renders counselling documents as a separate source and keeps CCMS documents', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'c1',
              sessionId: 'session-1',
              documentName: 'referral.pdf',
              documentType: 'ReferralLetter',
              status: 'active',
              createdAt: '2026-09-03',
              updatedAt: '2026-09-04',
              fileType: 'pdf',
              fileSizeBytes: '1024 bytes',
              canonicalDocumentId: null,
            },
            {
              id: 'c2',
              sessionId: 'session-2',
              documentName: 'card.pdf',
              documentType: 'InsuranceCard',
              status: 'active',
              createdAt: '2026-09-05',
              updatedAt: null,
              fileType: 'pdf',
              fileSizeBytes: '512 bytes',
              canonicalDocumentId: null,
            },
          ],
        }}
      />,
    );
    expect(html).toContain('Source: CCMS Documents');
    expect(html).toContain('Source: Counselling Documents');
    expect(html).toContain('letter.pdf');
    expect(html).toContain('referral.pdf');
    expect(html).toContain('card.pdf');
    expect(html).toContain('Referral Letter');
    expect(html).toContain('Preview');
    expect(html).toContain('Active');
    expect(html).not.toMatch(/filePath|files\.example|blobUrl|accessUrl/i);
    expect(html).not.toMatch(/Delete|Approve/i);
  });

  it('offers counselling Preview Download Print only with session read and canonical id', () => {
    const withCanonical = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'c1',
              sessionId: 'session-1',
              documentName: 'referral.pdf',
              documentType: 'ReferralLetter',
              status: 'active',
              createdAt: '2026-09-03',
              updatedAt: null,
              fileType: 'pdf',
              fileSizeBytes: '1024 bytes',
              canonicalDocumentId: 'can-99',
            },
          ],
        }}
        canReadCounsellingDocuments
        onCounsellingDownload={() => undefined}
        onCounsellingPreviewContent={async () => new Blob()}
      />,
    );
    expect(withCanonical).toContain('Source: Counselling Documents');
    expect(withCanonical).toContain('Download');
    expect(withCanonical).toContain('Print');
    expect(withCanonical).toContain('Preview');
    expect(withCanonical).toContain('Referral Letter');

    const withoutPermission = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'c1',
              sessionId: 'session-1',
              documentName: 'referral.pdf',
              documentType: 'ReferralLetter',
              status: 'active',
              createdAt: '2026-09-03',
              updatedAt: null,
              fileType: 'pdf',
              fileSizeBytes: '1024 bytes',
              canonicalDocumentId: 'can-99',
            },
          ],
        }}
        canDownload
        onDownload={() => undefined}
        onPreviewContent={async () => new Blob()}
      />,
    );
    expect(withoutPermission).toContain('Preview');
    expect(withoutPermission).not.toMatch(/>Download</);
    expect(withoutPermission).not.toMatch(/>Print</);
  });

  it('shows Remove only for the counselling uploader with delete permission', () => {
    const baseRow = {
      id: 'c1',
      sessionId: 'session-1',
      documentName: 'referral.pdf',
      documentType: 'ReferralLetter',
      status: 'active',
      createdAt: '2026-09-03',
      updatedAt: null,
      fileType: 'pdf',
      fileSizeBytes: '1024 bytes',
      canonicalDocumentId: 'can-99',
      createdByUserId: 'user-uploader',
    };

    const uploader = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [baseRow] }}
        canReadCounsellingDocuments
        canDeleteCounsellingDocuments
        currentUserId="user-uploader"
        onCounsellingDownload={() => undefined}
        onCounsellingPreviewContent={async () => new Blob()}
        onCounsellingRemove={() => undefined}
      />,
    );
    expect(uploader).toContain('Remove');

    const otherUser = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [baseRow] }}
        canReadCounsellingDocuments
        canDeleteCounsellingDocuments
        currentUserId="user-other"
        onCounsellingDownload={() => undefined}
        onCounsellingPreviewContent={async () => new Blob()}
        onCounsellingRemove={() => undefined}
      />,
    );
    expect(otherUser).not.toContain('Remove');

    const noPermission = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [baseRow] }}
        canReadCounsellingDocuments
        currentUserId="user-uploader"
        onCounsellingDownload={() => undefined}
        onCounsellingPreviewContent={async () => new Blob()}
        onCounsellingRemove={() => undefined}
      />,
    );
    expect(noPermission).not.toContain('Remove');
  });

  it('renders general patient documents as a distinct source beside CCMS and counselling', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'c1',
              sessionId: 'session-1',
              documentName: 'referral.pdf',
              documentType: 'ReferralLetter',
              status: 'active',
              createdAt: '2026-09-03',
              updatedAt: null,
              fileType: 'pdf',
              fileSizeBytes: '1024 bytes',
              canonicalDocumentId: null,
            },
          ],
        }}
        generalDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'g1',
              fileName: 'id-scan.pdf',
              classification: 'general',
              status: 'active',
              createdAt: '2026-10-06',
              mimeType: 'application/pdf',
              fileSizeBytes: '2048 bytes',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('Source: CCMS Documents');
    expect(html).toContain('Source: Counselling Documents');
    expect(html).toContain('Source: General Patient Documents');
    expect(html).toContain('letter.pdf');
    expect(html).toContain('referral.pdf');
    expect(html).toContain('id-scan.pdf');
    expect(html).toContain('General Document');
    expect(html).not.toContain('classification">general');
    expect(html).not.toContain('MPI documents are not available in Patient 360.');
    expect(html).not.toMatch(/storageObjectKey|patient-documents|blobUrl|accessUrl/i);
  });

  it('keeps counselling empty, denied, and failed states out of the All index', () => {
    const empty = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
      />,
    );
    expect(empty).not.toContain('No counselling documents recorded.');
    expect(empty).toContain('letter.pdf');
    expect(empty).not.toContain('No CCMS documents recorded.');

    const denied = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{ state: 'unauthorized', rows: [] }}
      />,
    );
    expect(denied).toContain('letter.pdf');
    expect(denied).not.toContain('Counselling document information is not available to this sign-in.');
    expect(denied).not.toContain('No counselling documents recorded.');

    const failed = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{ state: 'unavailable', rows: [] }}
      />,
    );
    expect(failed).toContain('letter.pdf');
    expect(failed).not.toContain('Counselling document information is unavailable.');
    expect(failed).not.toContain('No counselling documents recorded.');

    const counsellingTab = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="counselling"
      />,
    );
    expect(counsellingTab).toContain('No counselling documents recorded.');
    expect(counsellingTab).not.toContain('letter.pdf');
  });

  it('loads by patient id inside Documents and leaves the other sections in place', () => {
    const root = resolve(__dirname, '../../..');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Documents.tsx'), 'utf8');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-documents.ts'), 'utf8');
    expect(panel).toContain('usePatientRecord()');
    expect(panel).toContain('patientId');
    expect(panel).toContain('loadPatient360Documents(patientId, documentPage)');
    expect(panel).toContain('loadPatient360InsuranceDocuments(patientId, insuranceDocumentPage)');
    expect(panel).toContain('loadPatient360CounsellingDocuments(patientId, counsellingDocumentPage)');
    expect(panel).toContain('loadPatient360GeneralDocuments(patientId, generalDocumentPage)');
    expect(panel).toContain('loadPatient360Clinical');
    expect(panel).toContain('loadPatient360ImagingFiles');
    expect(panel).toContain('overflow-x-hidden');
    expect(panel).not.toContain('>Documents</h2>');
    expect(panel).not.toContain('<h2');
    expect(reads).toContain('getDocumentsByPatient');
    const counsellingReads = readFileSync(
      resolve(root, 'lib/patients/patient-360-counselling-documents.ts'),
      'utf8',
    );
    expect(counsellingReads).toContain('getCounselingDocumentsByPatient');
    expect(counsellingReads).not.toMatch(/filePath|uploadAudio|verifyDocument|deleteDocument/i);
    expect(reads).not.toMatch(/uploadDocument|deleteDocument|access-url|\/content|workspace/i);
    expect(panel).toContain('downloadPatient360CcmsDocument');
    expect(panel).toContain('ccms.document.read');
    expect(panel).not.toMatch(/uploadCcms|deleteDocument|getDocumentContent/i);
    expect(page).toContain("section === 'documents'");
    expect(page).toContain('<Patient360DocumentsPanel />');
    expect(page).toContain('<Patient360CoveragePanel />');
    expect(page).toContain('<Patient360OverviewPanel />');
    expect(page).toContain('<Patient360ClinicalPanel />');
    expect(page).toContain('<Patient360AdministrationPanel />');
    expect(page).toContain('<Patient360CarePanel />');
    expect(page).toContain('<Patient360SectionBody section={section} />');
    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
  });
});

describe('patient 360 document pagination', () => {
  it('pages CCMS and counselling metadata without download actions', () => {
    const counsellingLetter = {
      id: 'c-letter',
      sessionId: 'session-1',
      documentName: 'letter.pdf',
      documentType: 'ReferralLetter',
      status: 'active',
      createdAt: '2026-09-01',
      updatedAt: null,
      fileType: 'pdf',
      fileSizeBytes: '2048 bytes',
      canonicalDocumentId: null as string | null,
    };
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter], totalCount: 21, pageNumber: 2, pageSize: 20 }}
        counsellingDocuments={{
          state: 'ready',
          rows: [counsellingLetter],
          totalCount: 21,
          pageNumber: 1,
          pageSize: 20,
        }}
        onDocumentsPageChange={() => undefined}
        onCounsellingDocumentsPageChange={() => undefined}
      />,
    );
    expect(html).toContain('letter.pdf');
    expect(html).toContain('Showing 21–21 of 21');
    expect(html).toContain('CCMS documents pagination');
    expect(html).toContain('Counselling documents pagination');
    expect(html).toContain('Source: CCMS Documents');
    expect(html).toContain('Source: Counselling Documents');
    expect(html).not.toMatch(/download|blobUrl|filePath|Delete|Edit/i);

    const empty = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        counsellingDocuments={{ state: 'unauthorized', rows: [] }}
        generalDocuments={{ state: 'ready', rows: [] }}
        onDocumentsPageChange={() => undefined}
        onCounsellingDocumentsPageChange={() => undefined}
      />,
    );
    expect(empty).toContain('No documents recorded.');
    expect(empty).not.toContain('No CCMS documents recorded.');
    expect(empty).not.toContain('Counselling document information is not available to this sign-in.');
    expect(empty).not.toContain('CCMS documents pagination');
    expect(empty).not.toContain('Counselling documents pagination');

    const counsellingEmpty = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'unauthorized', rows: [] }}
        initialFilter="counselling"
      />,
    );
    expect(counsellingEmpty).toContain('Counselling document information is not available to this sign-in.');
  });
});

describe('patient 360 documents phase D index', () => {
  it('shows eligible CCMS insurance documents and keeps non-insurance CCMS off the Insurance filter', () => {
    const policy = {
      ...letter,
      id: 'ins-1',
      documentName: 'policy.pdf',
      documentType: 'policy_document',
      canonicalDocumentId: 'can-ins-1',
    };
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        insuranceDocuments={{ state: 'ready', rows: [policy] }}
        initialFilter="insurance"
        canReadCcmsDocuments
        onCcmsDownload={() => undefined}
        onCcmsPreviewContent={async () => new Blob(['x'])}
      />,
    );
    expect(html).toContain('policy.pdf');
    expect(html).not.toContain('letter.pdf');
    expect(html).not.toContain('Insurance documents are not available in Patient 360.');
    expect(html).toContain('Download');
    expect(html).toContain('Print');
    expect(html).toContain('<th');

    const empty = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        insuranceDocuments={{ state: 'ready', rows: [] }}
        initialFilter="insurance"
      />,
    );
    expect(empty).toContain('No insurance documents recorded.');
  });

  it('dedupes All-tab rows when CCMS shares a canonical identity with General', () => {
    const sharedId = 'canon-ccms-shared';
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{
          state: 'ready',
          rows: [
            {
              ...letter,
              id: 'ccms-1',
              documentName: 'shared-policy.pdf',
              documentType: 'policy_document',
              canonicalDocumentId: sharedId,
            },
          ],
        }}
        generalDocuments={{
          state: 'ready',
          rows: [
            {
              id: sharedId,
              patientId: 'p1',
              fileName: 'shared-policy.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 12,
              classification: 'general',
              status: 'active',
              createdAt: '2026-09-01',
              createdByUserId: 'u1',
            },
          ],
        }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
      />,
    );
    expect(html).toContain('shared-policy.pdf');
    // One table row (name appears in title + cell text).
    expect(html.match(/title="shared-policy\.pdf"/g)?.length).toBe(1);
    expect(html).toContain('General Patient Documents');
    expect(html).not.toContain('>CCMS Documents<');
  });

  it('indexes laboratory, imaging, and chart-note metadata from existing clinical sources', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'l1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: '4.5 x10^9/L',
              reference: '4.0-11.0',
              reportUrl: 'https://reports.example/cbc.pdf',
              canonicalDocumentId: null,
              canonicalFileName: null,
              canonicalMimeType: null,
            }],
          },
          notes: {
            state: 'ready',
            rows: [{
              id: 'n1',
              kind: 'Chart note',
              noteType: 'clinical',
              title: 'Post visit',
              when: '2026-08-06 08:00',
              status: 'active',
              content: 'Reviewed at length for the existing sheet',
              author: 'Nurse Patil',
            }],
          },
        }}
        imagingFiles={{
          state: 'ready',
          rows: [{
            id: 'img1',
            fileName: 'macula.png',
            modality: 'fundus',
            fileSize: '2048 bytes',
            contentType: 'image/png',
            uploadedAt: '2026-04-02 09:15',
          }],
          totalCount: 1,
          pageNumber: 1,
          pageSize: 20,
        }}
      />,
    );
    expect(html).toContain('CBC');
    expect(html).toContain('Laboratory');
    expect(html).toContain('Open report');
    expect(html).toContain('https://reports.example/cbc.pdf');
    expect(html).toContain('Post visit');
    expect(html).toContain('Chart notes');
    expect(html).toContain('View chart note');
    expect(html).toContain('macula.png');
    expect(html).toContain('Imaging files');
    expect(html).toContain('Preview');
    expect(html).not.toContain('4.5 x10^9/L');
    expect(html).not.toMatch(/\b(Delete|Approve|Download)\b/i);
  });

  it('shows Preview Download Print for lab canonical attachment and keeps Open report when ReportUrl exists', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        canReadLabDocuments
        canAttachLab
        onLabPreviewContent={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onLabDownload={() => undefined}
        onLabAttach={() => undefined}
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'l1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: null,
              reference: null,
              reportUrl: 'https://reports.example/cbc.pdf',
              canonicalDocumentId: 'can-lab-1',
              canonicalFileName: 'cbc-attached.pdf',
              canonicalMimeType: 'application/pdf',
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('Open report');
    expect(html).toContain('https://reports.example/cbc.pdf');
    expect(html).toContain('cbc-attached.pdf');
    expect(html).toContain('Preview');
    expect(html).toContain('Download');
    expect(html).toContain('Print');
    expect(html).not.toContain('Attach Report');
  });

  it('shows Attach Report on Documents Laboratory when LabReport has no canonical attachment', () => {
    const withAttach = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        canAttachLab
        onLabAttach={() => undefined}
        initialFilter="laboratory"
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'l1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: '4.5',
              reference: '4.0-11.0',
              reportUrl: null,
              canonicalDocumentId: null,
              canonicalFileName: null,
              canonicalMimeType: null,
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(withAttach).toContain('CBC');
    expect(withAttach).toContain('Attach Report');
    expect(withAttach).not.toContain('Preview');
    expect(withAttach).not.toContain('Download');
    expect(withAttach).not.toContain('Print');

    const withoutPermission = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        canAttachLab={false}
        onLabAttach={() => undefined}
        initialFilter="laboratory"
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'l1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: null,
              reference: null,
              reportUrl: null,
              canonicalDocumentId: null,
              canonicalFileName: null,
              canonicalMimeType: null,
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(withoutPermission).toContain('CBC');
    expect(withoutPermission).not.toContain('Attach Report');
  });

  it('uses Documents Laboratory empty copy distinct from Clinical', () => {
    const laboratory = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        clinical={{
          labs: { state: 'ready', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(laboratory).toContain('No laboratory documents available.');
    expect(laboratory).not.toContain('No lab results recorded.');
    expect(laboratory).not.toContain('Attach Report');
  });

  it('dedupes lab canonical identity on All when shared with general', () => {
    const sharedId = 'shared-lab-can';
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        generalDocuments={{
          state: 'ready',
          rows: [{
            id: sharedId,
            fileName: 'shared.pdf',
            classification: 'general',
            status: 'active',
            mimeType: 'application/pdf',
            createdAt: '2026-08-01T10:00:00Z',
            createdByUserId: 'u1',
            fileSizeBytes: '10',
          }],
          totalCount: 1,
          pageNumber: 1,
          pageSize: 20,
        }}
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'l1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: null,
              reference: null,
              reportUrl: null,
              canonicalDocumentId: sharedId,
              canonicalFileName: 'shared.pdf',
              canonicalMimeType: 'application/pdf',
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('shared.pdf');
    expect(html).toContain('General Patient Documents');
    expect(html.match(/>shared\.pdf</g)?.length ?? 0).toBe(1);
  });

  it('keeps unauthorized clinical document source messages on their own source views', () => {
    const all = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        clinical={{
          labs: { state: 'unauthorized', rows: [] },
          notes: { state: 'unavailable', rows: [] },
        }}
        imagingFiles={{ state: 'unauthorized', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(all).toContain('letter.pdf');
    expect(all).not.toContain('Laboratory reports are not available to this sign-in.');
    expect(all).not.toContain('Laboratory reports are not available in Patient 360.');
    expect(all).not.toContain('Chart notes are not available in Patient 360.');
    expect(all).not.toContain('Imaging files are not available to this sign-in.');
    expect(all).not.toContain('No laboratory reports recorded.');
    expect(all).not.toContain('No chart notes recorded.');
    expect(all).not.toContain('No imaging files recorded.');

    const laboratory = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        clinical={{
          labs: { state: 'unauthorized', rows: [] },
          notes: { state: 'unavailable', rows: [] },
        }}
        initialFilter="laboratory"
      />,
    );
    expect(laboratory).toContain('Laboratory reports are not available to this sign-in.');
    expect(laboratory).not.toContain('letter.pdf');

    const imaging = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        imagingFiles={{ state: 'unauthorized', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        initialFilter="imaging"
      />,
    );
    expect(imaging).toContain('Imaging files are not available to this sign-in.');
  });

  it('shows Upload document on the right of the document toolbar and does not use a General-only action label', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        canUpload
        onUploadClick={() => undefined}
      />,
    );
    expect(html).toContain('Upload document');
    expect(html).not.toContain('Upload general document');
    expect(html).toContain('justify-between');
    expect(html).toContain('aria-label="Document sources"');
    expect(html.indexOf('aria-label="Document sources"')).toBeLessThan(html.indexOf('Upload document'));
  });

  it('shows superseded general documents with newest listed in the general source', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [letter] }}
        generalDocuments={{
          state: 'ready',
          rows: [
            {
              id: 'g2',
              fileName: 'newer.pdf',
              classification: 'general',
              status: 'active',
              createdAt: '2026-10-07T14:31:00',
              mimeType: 'application/pdf',
              fileSizeBytes: '1024 bytes',
            },
            {
              id: 'g1',
              fileName: 'older.pdf',
              classification: 'general',
              status: 'superseded',
              createdAt: '2026-10-06',
              mimeType: 'application/pdf',
              fileSizeBytes: '1024 bytes',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('newer.pdf');
    expect(html).toContain('older.pdf');
    expect(html).toContain('Active');
    expect(html).toContain('Superseded');
    expect(html).toContain('07 Oct 2026 · 02:31 PM');
    expect(html).toContain('Source: CCMS Documents');
    expect(html.indexOf('newer.pdf')).toBeLessThan(html.indexOf('older.pdf'));
    expect(html.indexOf('newer.pdf')).toBeLessThan(html.indexOf('letter.pdf'));
  });

  it('keeps source-specific empty states off the All document index', () => {
    const all = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        generalDocuments={{
          state: 'ready',
          rows: [{
            id: 'g1',
            fileName: 'id-scan.pdf',
            classification: 'general',
            status: 'active',
            createdAt: '2026-10-06T14:31:00',
            mimeType: 'application/pdf',
            fileSizeBytes: '2048 bytes',
          }],
        }}
        clinical={{
          labs: { state: 'unavailable', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        canDownload
        onDownload={() => undefined}
        onPreviewContent={async () => new Blob(['pdf'], { type: 'application/pdf' })}
      />,
    );
    expect(all).toContain('id-scan.pdf');
    expect(all).toContain('General Document');
    expect(all).toContain('06 Oct 2026 · 02:31 PM');
    expect(all).toContain('Preview');
    expect(all).toContain('Download');
    expect(all).toContain('Print');
    expect(all.indexOf('Preview')).toBeLessThan(all.indexOf('Download'));
    expect(all.indexOf('Download')).toBeLessThan(all.indexOf('Print'));
    expect(all).not.toContain('View details');
    expect(all).not.toContain('SheetContent');
    expect(all).not.toContain('Laboratory reports are not available in Patient 360.');
    expect(all).not.toContain('Insurance documents are not available in Patient 360.');
    expect(all).not.toContain('No counselling documents recorded.');
    expect(all).not.toContain('No imaging files recorded.');

    const laboratory = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        clinical={{
          labs: { state: 'unavailable', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
        initialFilter="laboratory"
      />,
    );
    expect(laboratory).toContain('Laboratory reports are not available in Patient 360.');

    const imaging = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        initialFilter="imaging"
      />,
    );
    expect(imaging).toContain('No imaging files recorded.');
  });

  it('uses Portal AlertDialog for counselling and general remove confirmation instead of window.confirm', () => {
    const source = readFileSync(resolve(__dirname, 'Patient360Documents.tsx'), 'utf8');
    expect(source).not.toContain('window.confirm');
    expect(source).not.toContain('window.alert');
    expect(source).toContain("from '@/components/ui/alert-dialog'");
    expect(source).toContain('AlertDialog');
    expect(source).toContain('COUNSELLING_DOCUMENT_REMOVE_CONFIRM');
    expect(source).toContain('GENERAL_DOCUMENT_REMOVE_CONFIRM');
    expect(source).toContain('data-testid="patient-360-document-remove-confirm"');
    expect(source).toContain('data-testid="patient-360-document-remove-confirm-submit"');
    expect(source).toContain('bg-red-600');
    expect(source).toContain("kind: 'counselling' | 'general'");
    expect(source).toContain('deleteCounselingSessionDocument');
    expect(source).toContain('deleteCanonicalPatientDocument');
    expect(source).toContain('patient.patient_document.delete');
    expect(source).toContain('canDeleteGeneralDocuments');
    expect(source).toContain('row.createdByUserId === currentUserId');
    expect(source).toContain('onGeneralRemove');
  });

  // --- L-REP-03 CUT D-B LMS Official PDF projection ---

  const lmsOfficialRow = {
    reportId: 'lms-r1',
    operatingBranchId: 'branch-1',
    businessReportNumber: 'UAT-RPT-20261013-000001',
    reportStatus: 'Released',
    artifactId: 'art-2',
    artifactVersion: 2,
    canonicalDocumentId: 'canon-lms-1',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    generatedAtUtc: '2026-10-13T09:00:00Z',
    fileName: 'UAT-RPT-20261013-000001.pdf',
    sourceDomain: 'enterprise_lms',
    sourceEntityType: 'LmsReportOfficialPdfArtifact',
  };

  it('shows LMS Official PDF in Documents Laboratory with distinct source/type', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        canReadLmsOfficialPdfs
        canDownloadLmsOfficialPdfs
        onLmsOfficialPdfPreviewContent={async () => new Blob(['%PDF'], { type: 'application/pdf' })}
        onLmsOfficialPdfDownload={() => undefined}
        lmsOfficialPdfs={{ state: 'ready', rows: [lmsOfficialRow] }}
        clinical={{
          labs: { state: 'ready', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('UAT-RPT-20261013-000001');
    expect(html).toContain('LMS Official PDF');
    expect(html).toContain('Enterprise LMS Laboratory');
    expect(html).toContain('Preview');
    expect(html).toContain('Download');
    expect(html).toContain('Print');
    expect(html).not.toContain('Attach Report');
  });

  it('keeps Pathology Lab report labels distinct from LMS Official PDF', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        canReadLabDocuments
        canReadLmsOfficialPdfs
        canDownloadLmsOfficialPdfs
        onLabPreviewContent={async () => new Blob(['pdf'], { type: 'application/pdf' })}
        onLabDownload={() => undefined}
        onLmsOfficialPdfPreviewContent={async () => new Blob(['%PDF'], { type: 'application/pdf' })}
        onLmsOfficialPdfDownload={() => undefined}
        lmsOfficialPdfs={{ state: 'ready', rows: [lmsOfficialRow] }}
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'path-1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: null,
              reference: null,
              reportUrl: null,
              canonicalDocumentId: 'canon-path-1',
              canonicalFileName: 'cbc.pdf',
              canonicalMimeType: 'application/pdf',
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('Lab report');
    expect(html).toContain('Laboratory');
    expect(html).toContain('LMS Official PDF');
    expect(html).toContain('Enterprise LMS Laboratory');
    expect(html).toContain('cbc.pdf');
    expect(html).toContain('UAT-RPT-20261013-000001');
  });

  it('does not duplicate the same LMS canonical document on Patient 360 All', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        generalDocuments={{
          state: 'ready',
          rows: [{
            id: 'canon-lms-1',
            fileName: 'UAT-RPT-20261013-000001.pdf',
            classification: 'other',
            status: 'active',
            createdAt: '2026-10-13T08:00:00Z',
            mimeType: 'application/pdf',
            fileSizeBytes: '2048',
            createdByUserId: 'u1',
          }],
        }}
        canDownload
        onPreviewContent={async () => new Blob(['x'])}
        onDownload={() => undefined}
        canReadLmsOfficialPdfs
        canDownloadLmsOfficialPdfs
        onLmsOfficialPdfPreviewContent={async () => new Blob(['%PDF'], { type: 'application/pdf' })}
        onLmsOfficialPdfDownload={() => undefined}
        lmsOfficialPdfs={{ state: 'ready', rows: [lmsOfficialRow] }}
        clinical={{
          labs: { state: 'ready', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
        initialFilter="all"
      />,
    );
    const matches = html.match(/UAT-RPT-20261013-000001/g) ?? [];
    // Document name once in the All-tab row (deduped); not a second Laboratory LMS row.
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(html).not.toContain('Enterprise LMS Laboratory');
  });

  it('wires LMS Official PDF content through authenticated downloadLmsOfficialPdf (not patient.view)', () => {
    const source = readFileSync(resolve(__dirname, 'Patient360Documents.tsx'), 'utf8');
    expect(source).toContain('downloadLmsOfficialPdf');
    expect(source).toContain('LMS_REPORTS_PERMISSIONS');
    expect(source).toContain('LMS_REPORTS_PERMISSIONS.view');
    expect(source).toContain('LMS_REPORTS_PERMISSIONS.manage');
    expect(source).toContain('LMS_REPORTS_PERMISSIONS.download');
    expect(source).toContain('loadPatient360LmsOfficialPdfs');
    expect(source).toContain('useHasAnyPermission');
    expect(source).toMatch(
      /useHasAnyPermission\(\[\s*LMS_REPORTS_PERMISSIONS\.view\s*,\s*LMS_REPORTS_PERMISSIONS\.manage\s*,?\s*\]\)/s,
    );
    expect(source).not.toMatch(/onLmsOfficialPdfPreviewContent[\s\S]{0,80}patient\.view/);
    expect(source).not.toContain('patient-portal');
    expect(source).not.toContain('/portal/');
  });

  it('LMS Official PDF Print uses the same authenticated loadContent path as Preview', () => {
    // D-D P1-2 — source-static (suite convention); not a runtime interaction test.
    const source = readFileSync(resolve(__dirname, 'Patient360Documents.tsx'), 'utf8');
    const actionStart = source.indexOf('function lmsOfficialPdfAction(');
    expect(actionStart).toBeGreaterThanOrEqual(0);
    const actionEnd = source.indexOf('\nfunction ', actionStart + 1);
    const action = source.slice(actionStart, actionEnd > actionStart ? actionEnd : undefined);

    expect(action).toContain(
      'const loadContent = canContent && onLmsPreviewContent ? () => onLmsPreviewContent(row) : undefined',
    );
    expect(action).toContain('loadContent={loadContent}');
    expect(action).toMatch(
      /runPatient360DocumentPrint\(\{\s*fileName:\s*row\.fileName,\s*mimeType:\s*row\.mimeType,\s*loadContent,\s*\}\)/s,
    );
    expect(action).not.toContain('downloadLabReportContent');
    expect(action).not.toMatch(/sas|blob\.core\.windows\.net/i);
    expect(action).not.toContain('patient-portal');
    expect(action).not.toContain('/portal/');

    // Container binds Preview/Print content loader to authenticated LMS Download (CUT C path).
    expect(source).toContain('onLmsOfficialPdfPreviewContent={(row) =>');
    expect(source).toContain('downloadLmsOfficialPdf({');
    expect(source).toContain('reportId: row.reportId');
    expect(source).toContain('operatingBranchId: row.operatingBranchId');
    const previewBind = source.indexOf('onLmsOfficialPdfPreviewContent={(row) =>');
    const downloadCall = source.indexOf('downloadLmsOfficialPdf({', previewBind);
    expect(previewBind).toBeGreaterThanOrEqual(0);
    expect(downloadCall).toBeGreaterThan(previewBind);
    expect(downloadCall - previewBind).toBeLessThan(120);
  });

  it('keeps Pathology Attach Report and shows LMS Official PDF together', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        canReadLabDocuments
        canAttachLab
        onLabAttach={() => undefined}
        canReadLmsOfficialPdfs
        canDownloadLmsOfficialPdfs
        onLmsOfficialPdfPreviewContent={async () => new Blob(['%PDF'], { type: 'application/pdf' })}
        onLmsOfficialPdfDownload={() => undefined}
        lmsOfficialPdfs={{ state: 'ready', rows: [lmsOfficialRow] }}
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'path-attach-1',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: null,
              reference: null,
              reportUrl: null,
              canonicalDocumentId: null,
              canonicalFileName: null,
              canonicalMimeType: null,
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('Attach Report');
    expect(html).toContain('Lab report');
    expect(html).toContain('LMS Official PDF');
    expect(html).toContain('Enterprise LMS Laboratory');
    expect(html).toContain('UAT-RPT-20261013-000001');
  });

  it('does not hide LMS projection failure when Pathology Attach Report rows exist', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        canReadLabDocuments
        canAttachLab
        onLabAttach={() => undefined}
        canReadLmsOfficialPdfs
        lmsOfficialPdfs={{ state: 'unavailable', rows: [] }}
        clinical={{
          labs: {
            state: 'ready',
            rows: [{
              id: 'path-attach-2',
              title: 'CBC',
              when: '2026-08-03 11:00',
              status: 'completed',
              detail: null,
              reference: null,
              reportUrl: null,
              canonicalDocumentId: null,
              canonicalFileName: null,
              canonicalMimeType: null,
            }],
          },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('Attach Report');
    expect(html).toContain('Enterprise LMS Official PDFs are not available in Patient 360.');
    expect(html).not.toContain('Enterprise LMS Laboratory');
    expect(html).not.toContain('>LMS Official PDF<');
  });

  it('shows unauthorized LMS laboratory honesty without inventing Patient Portal copy', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        canReadLmsOfficialPdfs
        lmsOfficialPdfs={{ state: 'unauthorized', rows: [] }}
        clinical={{
          labs: { state: 'ready', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('Enterprise LMS Official PDFs are not available to this sign-in.');
    expect(html).not.toContain('Patient Portal');
  });

  it('renders report number and current artifact metadata for LMS Official PDF rows', () => {
    const html = renderToStaticMarkup(
      <Patient360DocumentsView
        documents={{ state: 'ready', rows: [] }}
        counsellingDocuments={{ state: 'ready', rows: [] }}
        initialFilter="laboratory"
        canReadLmsOfficialPdfs
        canDownloadLmsOfficialPdfs
        onLmsOfficialPdfPreviewContent={async () => new Blob(['%PDF'], { type: 'application/pdf' })}
        onLmsOfficialPdfDownload={() => undefined}
        lmsOfficialPdfs={{ state: 'ready', rows: [lmsOfficialRow] }}
        clinical={{
          labs: { state: 'ready', rows: [] },
          notes: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('UAT-RPT-20261013-000001');
    expect(html).toContain('Released');
    expect(html).toContain('LMS Official PDF');
  });
});

