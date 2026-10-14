import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  laboratoryDocumentsCombinedEmpty,
  laboratoryLmsHonestyAlongsidePathology,
  loadPatient360LmsOfficialPdfs,
  LMS_OFFICIAL_PDF_SOURCE_LABEL,
  LMS_OFFICIAL_PDF_TYPE_LABEL,
  lmsOfficialPdfUnavailableMessage,
  mapPatientCurrentLmsOfficialPdf,
} from '@/lib/patients/patient-360-lms-official-pdf';

vi.mock('@/lib/lms/lms-reports.api', () => ({
  listPatientCurrentLmsOfficialPdfs: vi.fn(),
  downloadLmsOfficialPdf: vi.fn(),
}));

import { listPatientCurrentLmsOfficialPdfs } from '@/lib/lms/lms-reports.api';

describe('patient-360-lms-official-pdf', () => {
  beforeEach(() => {
    vi.mocked(listPatientCurrentLmsOfficialPdfs).mockReset();
  });

  it('maps eligible current Official PDF projection metadata', () => {
    const row = mapPatientCurrentLmsOfficialPdf({
      reportId: 'r1',
      patientId: 'p1',
      operatingBranchId: 'b1',
      businessReportNumber: 'UAT-RPT-001',
      reportStatus: 'Released',
      artifactId: 'a1',
      artifactVersion: 2,
      canonicalDocumentId: 'c1',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      generatedAtUtc: '2026-10-13T10:00:00Z',
      sourceDomain: 'enterprise_lms',
      sourceEntityType: 'LmsReportOfficialPdfArtifact',
    });
    expect(row).toMatchObject({
      reportId: 'r1',
      businessReportNumber: 'UAT-RPT-001',
      fileName: 'UAT-RPT-001.pdf',
      canonicalDocumentId: 'c1',
      artifactVersion: 2,
      sourceDomain: 'enterprise_lms',
    });
    expect(LMS_OFFICIAL_PDF_TYPE_LABEL).toBe('LMS Official PDF');
    expect(LMS_OFFICIAL_PDF_SOURCE_LABEL).toBe('Enterprise LMS Laboratory');
  });

  it('rejects incomplete projection rows', () => {
    expect(
      mapPatientCurrentLmsOfficialPdf({
        reportId: 'r1',
        patientId: 'p1',
        operatingBranchId: '',
        businessReportNumber: 'UAT-RPT-001',
        reportStatus: 'Released',
        artifactId: 'a1',
        artifactVersion: 1,
        canonicalDocumentId: 'c1',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        generatedAtUtc: '2026-10-13T10:00:00Z',
        sourceDomain: 'enterprise_lms',
        sourceEntityType: 'LmsReportOfficialPdfArtifact',
      }),
    ).toBeNull();
  });

  it('loads ready rows from LaboratoryApi projection', async () => {
    vi.mocked(listPatientCurrentLmsOfficialPdfs).mockResolvedValue([
      {
        reportId: 'r1',
        patientId: 'p1',
        operatingBranchId: 'b1',
        businessReportNumber: 'UAT-RPT-001',
        reportStatus: 'Released',
        artifactId: 'a1',
        artifactVersion: 1,
        canonicalDocumentId: 'c1',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        generatedAtUtc: '2026-10-13T10:00:00Z',
        sourceDomain: 'enterprise_lms',
        sourceEntityType: 'LmsReportOfficialPdfArtifact',
      },
    ]);
    await expect(loadPatient360LmsOfficialPdfs('p1')).resolves.toEqual({
      state: 'ready',
      rows: [
        expect.objectContaining({
          reportId: 'r1',
          businessReportNumber: 'UAT-RPT-001',
          fileName: 'UAT-RPT-001.pdf',
        }),
      ],
    });
  });

  it('maps 403 to unauthorized without inventing rows', async () => {
    vi.mocked(listPatientCurrentLmsOfficialPdfs).mockRejectedValue({ response: { status: 403 } });
    await expect(loadPatient360LmsOfficialPdfs('p1')).resolves.toEqual({
      state: 'unauthorized',
      rows: [],
    });
  });

  it('keeps combined laboratory empty copy when both sources are empty', () => {
    expect(laboratoryDocumentsCombinedEmpty('ready', 'ready', 0, 0)).toBe(
      'No laboratory documents available.',
    );
  });

  it('surfaces LMS unavailable honesty beside Pathology rows (does not treat failure as empty success)', () => {
    expect(laboratoryLmsHonestyAlongsidePathology('unavailable', true, 1, 0)).toBe(
      lmsOfficialPdfUnavailableMessage(),
    );
    expect(laboratoryLmsHonestyAlongsidePathology('ready', true, 1, 0)).toBeNull();
    expect(laboratoryLmsHonestyAlongsidePathology('unavailable', true, 0, 0)).toBeNull();
  });

  it('maps 404 projection miss to unavailable (not ready empty)', async () => {
    vi.mocked(listPatientCurrentLmsOfficialPdfs).mockRejectedValue({ response: { status: 404 } });
    await expect(loadPatient360LmsOfficialPdfs('p1')).resolves.toEqual({
      state: 'unavailable',
      rows: [],
    });
  });
});
