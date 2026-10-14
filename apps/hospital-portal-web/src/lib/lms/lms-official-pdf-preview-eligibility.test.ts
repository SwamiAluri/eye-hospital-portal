import { describe, expect, it } from 'vitest';
import { isLmsOfficialPdfPreviewEligible } from '@/lib/lms/lms-official-pdf-preview-eligibility';
import type { LmsOfficialPdfArtifactMetadataDto } from '@/lib/lms/lms-reports.api';

const succeededArtifact: LmsOfficialPdfArtifactMetadataDto = {
  artifactId: 'art-1',
  artifactVersion: 1,
  status: 'Succeeded',
  mimeType: 'application/pdf',
  sizeBytes: 100,
  contentHash: 'abc',
  canonicalDocumentId: 'doc-1',
  templateVersionId: 'tpl-1',
  templateVersionNumber: 1,
  templateCode: 'DEFAULT',
  generatedByUserId: 'user-1',
  generatedAtUtc: '2026-10-13T00:00:00Z',
};

function baseDetail(
  overrides: Partial<{
    status: string;
    businessReportNumber: string | null;
    currentOfficialArtifactId: string | null;
    currentOfficialArtifact: LmsOfficialPdfArtifactMetadataDto | null;
  }> = {},
) {
  return {
    status: 'Released',
    businessReportNumber: 'LAB-2026-000001',
    currentOfficialArtifactId: 'art-1',
    currentOfficialArtifact: succeededArtifact,
    ...overrides,
  };
}

describe('isLmsOfficialPdfPreviewEligible', () => {
  it('is true for Released numbered report with Succeeded current Official PDF', () => {
    expect(isLmsOfficialPdfPreviewEligible(baseDetail())).toBe(true);
  });

  it('is false when report is not Released', () => {
    expect(isLmsOfficialPdfPreviewEligible(baseDetail({ status: 'Draft' }))).toBe(false);
    expect(isLmsOfficialPdfPreviewEligible(baseDetail({ status: 'Final' }))).toBe(false);
  });

  it('is false when Business Report Number is missing', () => {
    expect(isLmsOfficialPdfPreviewEligible(baseDetail({ businessReportNumber: null }))).toBe(
      false,
    );
    expect(isLmsOfficialPdfPreviewEligible(baseDetail({ businessReportNumber: '' }))).toBe(false);
  });

  it('is false when there is no current Official PDF artifact', () => {
    expect(
      isLmsOfficialPdfPreviewEligible(
        baseDetail({ currentOfficialArtifactId: null, currentOfficialArtifact: null }),
      ),
    ).toBe(false);
  });

  it('is false when pointer exists but current artifact metadata is unavailable', () => {
    // D-C: do not offer Preview/Download/Print when current metadata is missing.
    expect(
      isLmsOfficialPdfPreviewEligible(
        baseDetail({ currentOfficialArtifactId: 'art-1', currentOfficialArtifact: null }),
      ),
    ).toBe(false);
  });

  it('is false when current artifact is not Succeeded', () => {
    expect(
      isLmsOfficialPdfPreviewEligible(
        baseDetail({
          currentOfficialArtifact: { ...succeededArtifact, status: 'Failed' },
        }),
      ),
    ).toBe(false);
  });

  it('is false for null detail', () => {
    expect(isLmsOfficialPdfPreviewEligible(null)).toBe(false);
  });
});
