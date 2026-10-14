import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360ClinicalView } from '@/components/patients/record/Patient360Clinical';
import type { Patient360ClinicalBundle } from '@/lib/patients/patient-360-clinical';
import {
  classifyImagingFileError,
  imagingFilesEmptyMessage,
  imagingFilesUnauthorizedMessage,
  imagingFilesUnavailableMessage,
  mapImagingFile,
  type ImagingFileListResult,
} from '@/lib/patients/patient-360-imaging-files';
import type { PatientSummary } from '@/types/patient-lookup';

const root = resolve(__dirname, '../../..');

const summary = {
  id: 'p1',
  firstName: 'Asha',
  lastName: 'Rao',
  mrn: 'MRN-7',
  dateOfBirth: '1980-01-15',
  gender: 'Female',
  clinicalAcuity: 'low',
  allergies: '',
  activeEngagements: [],
  careProgramCodes: [],
  dataQuality: { isIncomplete: false, issues: [] },
} as PatientSummary;

function bundle(): Patient360ClinicalBundle {
  const empty = { state: 'ready' as const, rows: [] };
  return {
    vitals: empty,
    allergies: empty,
    examinations: empty,
    prescriptions: { state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 },
    labs: { state: 'ready', rows: [{ id: 'lab1', title: 'Hb', when: null, status: 'completed', detail: null, reference: null, reportUrl: null, canonicalDocumentId: null, canonicalFileName: null, canonicalMimeType: null }] },
    imaging: {
      state: 'ready',
      rows: [{ id: 'order1', title: 'Fundus', when: '2026-04-01 08:00', status: 'Completed', detail: 'OD' }],
    },
    optical: empty,
    notes: empty,
  };
}

function page(overrides: Partial<ImagingFileListResult> = {}): ImagingFileListResult {
  return { state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20, ...overrides };
}

function render(imagingFiles: ImagingFileListResult) {
  return renderToStaticMarkup(
    <Patient360ClinicalView
      summary={summary}
      bundle={bundle()}
      ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      imagingFiles={imagingFiles}
      onImagingFilesPageChange={() => undefined}
    />,
  );
}

describe('patient 360 imaging file metadata', () => {
  it('renders file metadata inside Imaging and keeps the order row', () => {
    const row = mapImagingFile({
      id: 'img1',
      fileName: 'macula.png',
      modality: 'fundus',
      fileSize: 2048,
      contentType: 'image/png',
      uploadedAt: '2026-04-02T09:15:00',
      imageUrl: 'https://storage.example/secret.png',
      thumbnailUrl: 'https://storage.example/thumb.png',
    });
    const html = render(
      page({
        rows: row ? [row] : [],
        totalCount: 1,
      }),
    );
    expect(html).toContain('>Imaging &amp; scans<');
    expect(html).toContain('Fundus');
    expect(html).toContain('>Files<');
    expect(html).toContain('macula.png');
    expect(html).toContain('Modality fundus');
    expect(html).toContain('View details');
    expect(html).toContain('2026-04-02 09:15');
    expect(html).not.toContain('secret.png');
    expect(html).not.toContain('thumbnail');
    expect(html).not.toContain('Open report');
    expect(html).not.toMatch(/Download|Preview|Upload|Manage Images|Add vital/i);
    expect(html).not.toMatch(/\bOCT\b|Electrophysiology/);
  });

  it('distinguishes empty, unauthorized, and unavailable', () => {
    expect(render(page())).toContain(imagingFilesEmptyMessage());
    const unauthorized = render(page({ state: 'unauthorized' }));
    expect(unauthorized).toContain(imagingFilesUnauthorizedMessage());
    expect(unauthorized).not.toContain(imagingFilesEmptyMessage());
    const unavailable = render(page({ state: 'unavailable' }));
    expect(unavailable).toContain(imagingFilesUnavailableMessage());
    expect(unavailable).not.toContain(imagingFilesEmptyMessage());
    expect(classifyImagingFileError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyImagingFileError({ response: { status: 500 } })).toBe('unavailable');
  });

  it('paginates imaging files without adding a second imaging destination', () => {
    const html = render(page({ totalCount: 40, pageNumber: 1, pageSize: 20 }));
    expect(html).toContain('aria-label="Imaging files pagination"');
    expect(html.match(/<h3[^>]*>Imaging &amp; scans</g)).toHaveLength(1);
    const pageSource = readFileSync(resolve(root, 'components/patients/record/Patient360Clinical.tsx'), 'utf8');
    const loader = readFileSync(resolve(root, 'lib/patients/patient-360-imaging-files.ts'), 'utf8');
    expect(loader).toContain('/Imaging/patient/${patientId}/patient-360/images');
    expect(loader).not.toMatch(/imageUrl|thumbnailUrl|downloadUrl|previewUrl/);
    expect(pageSource).not.toMatch(/Electrophysiology|Manage Images|patient_document_uploads/);
    expect(pageSource).toContain('title="Laboratory"');
    expect(pageSource).toContain('Open report');
  });
});
