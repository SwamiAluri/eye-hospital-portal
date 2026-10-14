import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ReportOfficialPdfPreview (L-REP-03 CUT D-A)', () => {
  const source = readFileSync(resolve(__dirname, 'ReportOfficialPdfPreview.tsx'), 'utf8');
  const detail = readFileSync(resolve(__dirname, 'ReportDetailView.tsx'), 'utf8');
  const workbench = readFileSync(resolve(__dirname, 'ReportsWorkbench.tsx'), 'utf8');

  it('uses Dialog + authenticated Blob object URL + PDF iframe without a new viewer package', () => {
    expect(source).toContain("from '@/components/ui/dialog'");
    expect(source).toContain('downloadLmsOfficialPdf');
    expect(source).toContain('URL.createObjectURL');
    expect(source).toContain('URL.revokeObjectURL');
    expect(source).toContain('<iframe');
    expect(source).toContain('data-testid="report-official-pdf-preview-dialog"');
    expect(source).toContain('data-testid="report-official-pdf-preview-loading"');
    expect(source).toContain('data-testid="report-official-pdf-preview-error"');
    expect(source).toContain('data-testid="report-official-pdf-preview-frame"');
    expect(source).toContain('cancelled');
    expect(source).toContain("triggerVariant === 'link'");
    expect(source).not.toContain('pdfjs');
    expect(source).not.toContain('react-pdf');
    expect(source).not.toContain('window.open(');
  });

  it('revokes object URLs on close and cancels stale loads when report context changes', () => {
    expect(source).toContain('if (createdUrl) URL.revokeObjectURL(createdUrl)');
    expect(source).toContain('URL.revokeObjectURL(objectUrl)');
    expect(source).toContain('cancelled = true');
    expect(source).toContain("setContentState('idle')");
    expect(source).toContain('[reportId, operatingBranchId]');
    expect(source).toContain('[open, loadContent]');
  });

  it('Report Detail wires Preview through shared component with reportId and branch', () => {
    expect(detail).toContain('ReportOfficialPdfPreview');
    expect(detail).toContain('downloadLmsOfficialPdf');
    expect(detail).toContain('isLmsOfficialPdfPreviewEligible');
    expect(detail).toContain('reportId={detail.id}');
    expect(detail).toContain('operatingBranchId={operatingBranchId}');
    expect(detail).toContain('triggerTestId="report-official-pdf-preview"');
    expect(detail).toContain('data-testid="report-official-pdf-download"');
    expect(detail).toMatch(/staff preview and download of the current Official/i);
    expect(source).toContain('data-testid={triggerTestId}');
  });

  it('Reports worklist shows Preview beside Open and Download for eligible rows only', () => {
    expect(workbench).toContain('ReportOfficialPdfPreview');
    expect(workbench).toContain('officialPdfDownloadEligible');
    expect(workbench).toContain('triggerVariant="link"');
    expect(workbench).toContain('triggerLabel="Preview"');
    expect(workbench).toContain('reports-preview-${row.id}');
    expect(workbench).toContain('reports-download-${row.id}');
    expect(workbench).toContain('reports-open-${row.id}');
    expect(workbench).toContain('downloadLmsOfficialPdf');
    expect(workbench).toMatch(/Open[\s\S]*ReportOfficialPdfPreview[\s\S]*reports-download-/);
    expect(workbench).not.toContain('generateLmsOfficialPdf');
  });
});
