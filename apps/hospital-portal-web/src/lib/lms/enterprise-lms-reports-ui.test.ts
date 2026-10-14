import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import { LMS_NAV_ITEMS } from '@/lib/lms/lms-navigation';
import { LMS_REPORTS_PERMISSIONS } from '@/lib/lms/lms-permissions';

const srcRoot = join(__dirname, '../../');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('L-REP-01 / L-REP-02A / L-REP-02B Reports UI', () => {
  it('registers Reports capability including Release metadata and staff download', () => {
    const cap = LMS_CAPABILITIES.find((c) => c.id === 'reports');
    expect(cap?.status).toBe('implemented');
    expect(cap?.href).toBe('/dashboard/lms/reports');
    expect(cap?.description).toMatch(/Draft \+ Finalize \+ Release metadata/i);
    expect(cap?.description).toMatch(/staff Official PDF download/i);
    expect(cap?.description).toMatch(/Patient publication not implemented/i);
  });

  it('exposes Reports navigation', () => {
    const reports = LMS_NAV_ITEMS.find((i) => i.href === '/dashboard/lms/reports');
    expect(reports?.label).toBe('Reports');
  });

  it('defines report permission catalogue without publish', () => {
    expect(LMS_REPORTS_PERMISSIONS.view).toBe('lms.reports.view');
    expect(LMS_REPORTS_PERMISSIONS.manage).toBe('lms.reports.manage');
    expect(LMS_REPORTS_PERMISSIONS.finalize).toBe('lms.reports.finalize');
    expect(LMS_REPORTS_PERMISSIONS.release).toBe('lms.reports.release');
    expect(LMS_REPORTS_PERMISSIONS.download).toBe('lms.reports.download');
    expect(LMS_REPORTS_PERMISSIONS.assignNumber).toBe('lms.reports.assign_number');
    expect(LMS_REPORTS_PERMISSIONS.generate).toBe('lms.reports.generate');
    expect(Object.values(LMS_REPORTS_PERMISSIONS)).not.toContain('lms.reports.publish');
  });

  it('Reports page mounts workbench with honest states', () => {
    const page = read('app/dashboard/lms/reports/page.tsx');
    expect(page).toContain('ReportsWorkbench');
    expect(page).not.toContain('LmsCapabilityPage');

    const wb = read('components/lms/reports/ReportsWorkbench.tsx');
    expect(wb).toContain('data-testid="reports-workbench"');
    expect(wb).toContain('data-testid="reports-empty"');
    expect(wb).toContain('data-testid="reports-loading"');
    expect(wb).toContain('data-testid="reports-error"');
    expect(wb).toContain('data-testid="reports-unauthorized"');
    expect(wb).toContain('data-testid="reports-create-panel"');
    expect(wb).toContain('createLmsReportDraft');
    expect(wb).toContain('listLmsReportEligibleSources');
    expect(wb).toMatch(/staff-only metadata/i);
    expect(wb).toMatch(/patient-visible/i);
    expect(wb).not.toContain('KPI');
    expect(wb).not.toContain('finalizeLmsReport');
    expect(wb).not.toContain('releaseLmsReport');
    expect(wb).not.toContain('assignLmsReportNumber');
    expect(wb).toContain('businessReportNumber');
    expect(wb).toContain('Report Number');
    expect(wb).toContain('officialPdfDownloadEligible');
    expect(wb).toContain('downloadLmsOfficialPdf');
    expect(wb).toContain('reports-download-');
    expect(wb).toContain('ReportOfficialPdfPreview');
    expect(wb).toContain('reports-preview-');
    expect(wb).toContain('triggerLabel="Preview"');
    expect(wb).not.toContain('generateLmsOfficialPdf');
    expect(wb).not.toMatch(/\bdownloadPdf\b/);
    expect(wb).not.toContain('lab-reports');
  });

  it('Report detail shows version provenance and snapshot preview', () => {
    const detail = read('components/lms/reports/ReportDetailView.tsx');
    expect(detail).toContain('data-testid="report-detail"');
    expect(detail).toContain('data-testid="report-version-history"');
    expect(detail).toContain('data-testid="report-snapshot-preview"');
    expect(detail).toContain('ResultVersionId');
    expect(detail).toMatch(/immutable/i);
    expect(detail).toMatch(/Staff preview and download of the current Official/i);
    expect(detail).toMatch(/No patient publication/i);
    expect(detail).not.toMatch(/\bdownloadPdf\b/);
    expect(detail).not.toContain('/api/lab-reports');
  });

  it('API client targets LaboratoryApi reports routes including finalize, release, assign-number, official-pdf generate, and download', () => {
    const api = read('lib/lms/lms-reports.api.ts');
    expect(api).toContain('/lms/reports');
    expect(api).toContain('/lms/reports/eligible-sources');
    expect(api).toContain('/finalize');
    expect(api).toContain('finalizeLmsReport');
    expect(api).toContain('/release');
    expect(api).toContain('releaseLmsReport');
    expect(api).toContain('/assign-number');
    expect(api).toContain('assignLmsReportNumber');
    expect(api).toContain('businessReportNumber');
    expect(api).toContain('/official-pdf/generate');
    expect(api).toContain('generateLmsOfficialPdf');
    expect(api).toContain('getLmsOfficialPdfJob');
    expect(api).toContain('downloadLmsOfficialPdf');
    expect(api).toContain('listPatientCurrentLmsOfficialPdfs');
    expect(api).toContain('/lms/patients/');
    expect(api).toContain('/current-official-pdfs');
    expect(api).toContain("responseType: 'blob'");
    expect(api).not.toContain('/api/lab-reports');
    expect(api).not.toContain('publish');
  });

  it('Finalize UI remains permission-aware with confirmation', () => {
    const detail = read('components/lms/reports/ReportDetailView.tsx');
    expect(detail).toContain('LMS_REPORTS_PERMISSIONS.finalize');
    expect(detail).toContain('data-testid="report-finalize-open"');
    expect(detail).toContain('data-testid="report-finalize-confirm"');
    expect(detail).toContain('data-testid="report-finalized-by"');
    expect(detail).toContain('data-testid="report-finalized-at"');
    expect(detail).toMatch(/will be frozen/i);
    expect(detail).toMatch(/does not Release/i);
    expect(detail).toMatch(/patient-visible/i);
    expect(detail).toContain('concurrency_conflict');
  });

  it('Release UI is permission-aware with confirmation and no PDF/download/publish/notify', () => {
    const detail = read('components/lms/reports/ReportDetailView.tsx');
    expect(detail).toContain('LMS_REPORTS_PERMISSIONS.release');
    expect(detail).toContain('data-testid="report-release-open"');
    expect(detail).toContain('data-testid="report-release-confirm"');
    expect(detail).toContain('data-testid="report-released-by"');
    expect(detail).toContain('data-testid="report-released-at"');
    expect(detail).toContain('Release Report');
    expect(detail).toContain("detail.status !== 'Final'");
    expect(detail).toContain("detail.status !== 'Draft'");
    expect(detail).toContain("detail?.status === 'Released'");
    expect(detail).toMatch(/does not generate a PDF/i);
    expect(detail).toMatch(/patient-visible/i);
    expect(detail).toContain('lms.reports.release');
    expect(detail).not.toMatch(/\bdownloadPdf\b/);
    expect(detail).not.toContain('data-testid="report-unrelease');
    expect(detail).not.toContain('data-testid="report-notify');
    expect(detail).not.toContain('data-testid="report-publish');
    expect(detail).not.toMatch(/Publish Report/i);
    expect(detail).not.toMatch(/>\s*Notify\s*</);
  });

  it('Assign Report Number UI is Released-only with confirmation', () => {
    const detail = read('components/lms/reports/ReportDetailView.tsx');
    expect(detail).toContain('LMS_REPORTS_PERMISSIONS.assignNumber');
    expect(detail).toContain('assignLmsReportNumber');
    expect(detail).toContain('data-testid="report-assign-number-panel"');
    expect(detail).toContain('data-testid="report-assign-number-open"');
    expect(detail).toContain('data-testid="report-assign-number-confirm"');
    expect(detail).toContain('data-testid="report-business-number"');
    expect(detail).toContain('Assign Report Number');
    expect(detail).toContain("detail.status !== 'Released'");
    expect(detail).toContain('businessReportNumber');
    expect(detail).toMatch(/does not generate a PDF/i);
    expect(detail).toMatch(/separate post-Release action/i);
  });

  it('Official PDF UI is Released+numbered, permission-aware, with generate, preview, and download', () => {
    const detail = read('components/lms/reports/ReportDetailView.tsx');
    expect(detail).toContain('LMS_REPORTS_PERMISSIONS.generate');
    expect(detail).toContain('LMS_REPORTS_PERMISSIONS.download');
    expect(detail).toContain('generateLmsOfficialPdf');
    expect(detail).toContain('downloadLmsOfficialPdf');
    expect(detail).toContain('ReportOfficialPdfPreview');
    expect(detail).toContain('isLmsOfficialPdfPreviewEligible');
    expect(detail).toContain('reportId={detail.id}');
    expect(detail).toContain('operatingBranchId={operatingBranchId}');
    expect(detail).toContain('data-testid="report-official-pdf-panel"');
    expect(detail).toContain('data-testid="report-official-pdf-generate-open"');
    expect(detail).toContain('data-testid="report-official-pdf-status"');
    expect(detail).toContain('data-testid="report-official-pdf-download"');
    expect(detail).toContain('Generate Official PDF');
    expect(detail).toContain('Download Official PDF');
    expect(detail).toContain('lms.reports.generate');
    expect(detail).toContain('lms.reports.download');
    expect(detail).toMatch(/Not patient publication/i);
    expect(detail).not.toMatch(/\bdownloadPdf\b/);
    expect(detail).not.toContain('data-testid="report-publish');

    const preview = read('components/lms/reports/ReportOfficialPdfPreview.tsx');
    expect(preview).toContain("triggerTestId = 'report-official-pdf-preview'");
    expect(preview).toContain('Preview Official PDF');
    expect(preview).toContain('URL.createObjectURL');
    expect(preview).toContain('downloadLmsOfficialPdf');
  });

  it('handles report_source_already_in_draft and reloads eligible after create', () => {
    const wb = read('components/lms/reports/ReportsWorkbench.tsx');
    expect(wb).toContain("report_source_already_in_draft");
    expect(wb).toMatch(/already included in a Draft Report/i);
    expect(wb).toContain('await loadEligible()');
    expect(wb).not.toMatch(/Downtown Hospital/);
    expect(wb).not.toMatch(/a34dfddc-5e21-4684-a436-4d192ecc96be/);
  });

  it('branch selector uses useBranchContext branchId/branchName fields and Orders current-branch fallback', () => {
    const wb = read('components/lms/reports/ReportsWorkbench.tsx');
    const hook = read('hooks/use-branch-context.ts');
    const orders = read('components/lms/orders/OrdersWorkbench.tsx');

    expect(hook).toContain("userBranchesApi.getMyBranches()");
    expect(hook).toContain('/user-branches/me');
    expect(hook).toMatch(/Never call GET \/branches\/\{id\}/);

    expect(wb).toContain('useBranchContext');
    expect(wb).toContain('branchId: contextBranchId');
    expect(wb).not.toMatch(/\{\s*branches,\s*selectedBranchId\s*\}/);
    expect(wb).toContain('b.branchId');
    expect(wb).toContain('b.branchName');
    expect(wb).not.toMatch(/branches\.map\(\(b\) => \(\s*<SelectItem key=\{b\.id\}/);
    expect(wb).not.toContain("value={b.id}");
    expect(wb).not.toContain('{b.name}');
    expect(wb).toContain('Current branch');
    expect(wb).toContain('selectBranch');
    expect(wb).toContain('operatingBranchId: branchId');
    expect(wb).toContain('data-testid="reports-branches-loading"');
    expect(wb).toContain('data-testid="reports-branches-error"');
    expect(wb).toContain('data-testid="reports-branches-empty"');
    expect(wb).not.toMatch(/Downtown Hospital/);
    expect(wb).not.toMatch(/GET \/branches\//);
    expect(wb).not.toMatch(/\/api\/lms\/branches/);

    expect(orders).toContain('branchId, branches');
    expect(orders).toContain('Current branch');
  });
});
