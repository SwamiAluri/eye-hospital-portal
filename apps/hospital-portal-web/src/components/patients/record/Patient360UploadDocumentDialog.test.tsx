import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNSELLING_GENERIC_DOCUMENT_TYPES } from '@/lib/api/counseling-sessions.api';
import { patient360DocumentTypesForArea } from '@/lib/patients/patient-360-document-areas';

describe('patient 360 upload document dialog', () => {
  it('uses Portal Select, area-dependent types, and blocks non-writable submit', () => {
    const source = readFileSync(
      resolve(__dirname, 'Patient360UploadDocumentDialog.tsx'),
      'utf8',
    );
    expect(source).toContain('Upload document');
    expect(source).toContain('Document area');
    expect(source).toContain('Document type');
    expect(source).toContain("from '@/components/ui/select'");
    expect(source).toContain('ModalSelectContent');
    expect(source).toContain('patient360DocumentTypesForArea(area)');
    expect(source).toContain('defaultPatient360DocumentTypeId');
    expect(source).toContain('selectArea');
    expect(source).toContain('!areaWritable');
    expect(source).toContain('disabled={uploading || !file || !areaWritable}');
    expect(source).toContain('Choose file');
    expect(source).toContain('Keep both');
    expect(source).toContain('Replace');
    expect(source).toContain('isWritablePatient360DocumentArea');
    expect(source).not.toContain('<select');
    expect(source).not.toContain('Upload general document');
    expect(source).not.toContain('domain = counselling');
  });

  it('uploads Counselling without a session selector using the nine certified types', () => {
    const source = readFileSync(
      resolve(__dirname, 'Patient360UploadDocumentDialog.tsx'),
      'utf8',
    );
    expect(source).toContain("area: 'counselling'");
    expect(source).toContain('documentType: classification');
    expect(source).toContain("area === 'counselling'");
    expect(source).not.toContain('Counselling session');
    expect(source).not.toContain('loadPatient360CounsellingSessions');
    expect(source).not.toContain('sessionId');
    expect(source).not.toContain('Select a Counselling session');
    expect(source).not.toContain('Available from Counselling workflow');
    expect(source).not.toContain('Follow-up');
    expect(source).not.toContain('InProgress');
    expect(source).not.toContain('counsellingReady');

    const types = patient360DocumentTypesForArea('counselling');
    expect(types).toHaveLength(9);
    expect(types.map((t) => t.id)).toEqual(COUNSELLING_GENERIC_DOCUMENT_TYPES.map((t) => t.id));
    expect(types.some((t) => t.id === 'AudioRecording')).toBe(false);
  });
});

describe('patient 360 documents action wiring', () => {
  it('keeps general document Print on the shared authenticated print helper', () => {
    const source = readFileSync(resolve(__dirname, 'Patient360Documents.tsx'), 'utf8');
    const printSource = readFileSync(
      resolve(__dirname, '../../../lib/patients/patient-360-document-print.ts'),
      'utf8',
    );
    expect(source).toContain('runPatient360DocumentPrint');
    expect(source).toContain('Patient360DocumentPreview');
    expect(source).toContain('onPreviewContent');
    expect(source).toContain('downloadCanonicalPatientDocument');
    expect(source).toContain('uploadCounselingPatientDocument');
    expect(source).not.toContain('uploadCounselingSessionDocument');
    expect(source).not.toContain('SheetTrigger');
    expect(printSource).toContain('data-patient-360-document-print-frame');
    expect(printSource).toContain('waitForPatient360PrintImages');
    expect(printSource).not.toContain('window.open(');
  });
});
