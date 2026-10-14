'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useHasPermission } from '@/hooks/use-permissions';
import { LMS_REPORTS_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  assignLmsReportNumber,
  downloadLmsOfficialPdf,
  finalizeLmsReport,
  generateLmsOfficialPdf,
  getLmsOfficialPdfJob,
  getLmsReport,
  parseLmsReportsApiError,
  releaseLmsReport,
  type LmsOfficialPdfJobDto,
  type LmsReportDetailDto,
} from '@/lib/lms/lms-reports.api';
import { ReportOfficialPdfPreview } from '@/components/lms/reports/ReportOfficialPdfPreview';
import { isLmsOfficialPdfPreviewEligible } from '@/lib/lms/lms-official-pdf-preview-eligibility';

type Props = {
  reportId: string;
  operatingBranchId: string;
};

export function ReportDetailView({ reportId, operatingBranchId }: Props) {
  const canView =
    useHasPermission(LMS_REPORTS_PERMISSIONS.view) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.manage) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.finalize) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.release) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.assignNumber) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.generate) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.download);
  const canFinalize = useHasPermission(LMS_REPORTS_PERMISSIONS.finalize);
  const canRelease = useHasPermission(LMS_REPORTS_PERMISSIONS.release);
  const canAssignNumber = useHasPermission(LMS_REPORTS_PERMISSIONS.assignNumber);
  const canGenerate = useHasPermission(LMS_REPORTS_PERMISSIONS.generate);
  const canDownload = useHasPermission(LMS_REPORTS_PERMISSIONS.download);
  const [detail, setDetail] = useState<LmsReportDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [confirmAssignNumber, setConfirmAssignNumber] = useState(false);
  const [assigningNumber, setAssigningNumber] = useState(false);
  const [assignNumberError, setAssignNumberError] = useState<string | null>(null);
  const [confirmGeneratePdf, setConfirmGeneratePdf] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatePdfError, setGeneratePdfError] = useState<string | null>(null);
  const [pdfJob, setPdfJob] = useState<LmsOfficialPdfJobDto | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadPdfError, setDownloadPdfError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView || !operatingBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLmsReport(reportId, operatingBranchId);
      setDetail(data);
      setSelectedVersion(data.currentVersionNumber);
      setPdfJob(data.officialPdfJob ?? null);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to load Report.');
      setError(parsed.message);
      setDetail(null);
      setPdfJob(null);
    } finally {
      setLoading(false);
    }
  }, [canView, reportId, operatingBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bounded status refresh while Official PDF job is Pending/Running (no uncontrolled polling).
  useEffect(() => {
    const status = pdfJob?.status;
    if (!status || (status !== 'Pending' && status !== 'Running') || !pdfJob?.jobId) return;
    let cancelled = false;
    const ticks = { count: 0 };
    const id = window.setInterval(() => {
      void (async () => {
        ticks.count += 1;
        if (ticks.count > 40 || cancelled) {
          window.clearInterval(id);
          return;
        }
        try {
          const job = await getLmsOfficialPdfJob({
            reportId,
            jobId: pdfJob.jobId,
            operatingBranchId,
          });
          if (cancelled) return;
          setPdfJob(job);
          if (job.status === 'Succeeded' || job.status === 'Failed') {
            window.clearInterval(id);
            await load();
          }
        } catch {
          // keep showing last known status; user can refresh detail
        }
      })();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pdfJob?.jobId, pdfJob?.status, reportId, operatingBranchId, load]);

  const onFinalize = async () => {
    if (!detail || !canFinalize || detail.status !== 'Draft') return;
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const updated = await finalizeLmsReport({
        reportId: detail.id,
        operatingBranchId,
        expectedRowVersion: detail.rowVersion,
      });
      setDetail(updated);
      setSelectedVersion(updated.currentVersionNumber);
      setConfirmFinalize(false);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to finalize Report.');
      if (parsed.code === 'concurrency_conflict' || parsed.status === 409) {
        setFinalizeError(
          parsed.code === 'concurrency_conflict'
            ? 'This Report changed. Refresh and try again.'
            : parsed.message,
        );
        await load();
      } else if (parsed.status === 403) {
        setFinalizeError('You do not have permission to finalize Reports (`lms.reports.finalize`).');
      } else {
        setFinalizeError(parsed.message);
      }
    } finally {
      setFinalizing(false);
    }
  };

  const onRelease = async () => {
    if (!detail || !canRelease || detail.status !== 'Final') return;
    setReleasing(true);
    setReleaseError(null);
    try {
      const updated = await releaseLmsReport({
        reportId: detail.id,
        operatingBranchId,
        expectedRowVersion: detail.rowVersion,
      });
      setDetail(updated);
      setSelectedVersion(updated.currentVersionNumber);
      setConfirmRelease(false);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to release Report.');
      if (parsed.code === 'concurrency_conflict' || parsed.status === 409) {
        setReleaseError(
          parsed.code === 'concurrency_conflict'
            ? 'This Report changed. Refresh and try again.'
            : parsed.message,
        );
        await load();
      } else if (parsed.status === 403) {
        setReleaseError('You do not have permission to release Reports (`lms.reports.release`).');
      } else {
        setReleaseError(parsed.message);
      }
    } finally {
      setReleasing(false);
    }
  };

  const onAssignNumber = async () => {
    if (
      !detail ||
      !canAssignNumber ||
      detail.status !== 'Released' ||
      !!detail.businessReportNumber
    ) {
      return;
    }
    setAssigningNumber(true);
    setAssignNumberError(null);
    try {
      const updated = await assignLmsReportNumber({
        reportId: detail.id,
        operatingBranchId,
        expectedRowVersion: detail.rowVersion,
      });
      setDetail(updated);
      setSelectedVersion(updated.currentVersionNumber);
      setConfirmAssignNumber(false);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to assign Report Number.');
      if (parsed.code === 'concurrency_conflict' || parsed.status === 409) {
        setAssignNumberError(
          parsed.code === 'concurrency_conflict'
            ? 'This Report changed. Refresh and try again.'
            : parsed.message,
        );
        await load();
      } else if (parsed.status === 403) {
        setAssignNumberError(
          'You do not have permission to assign Report Numbers (`lms.reports.assign_number`).',
        );
      } else if (parsed.code === 'report_number_configuration_missing') {
        setAssignNumberError(
          'Report Number configuration is missing for this operating branch.',
        );
      } else {
        setAssignNumberError(parsed.message);
      }
    } finally {
      setAssigningNumber(false);
    }
  };

  const onGenerateOfficialPdf = async () => {
    if (!detail || !canGenerate || detail.status !== 'Released' || !detail.businessReportNumber)
      return;
    setGeneratingPdf(true);
    setGeneratePdfError(null);
    try {
      const result = await generateLmsOfficialPdf({
        reportId: detail.id,
        operatingBranchId,
      });
      setPdfJob(result.job);
      setConfirmGeneratePdf(false);
      await load();
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to request Official PDF generation.');
      if (parsed.status === 403) {
        setGeneratePdfError(
          'You do not have permission to generate Official PDFs (`lms.reports.generate`).',
        );
      } else {
        setGeneratePdfError(parsed.message);
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  const downloadEligible = isLmsOfficialPdfPreviewEligible(detail);

  const onDownloadOfficialPdf = async () => {
    if (!detail || !canDownload || !downloadEligible || !detail.businessReportNumber) return;
    setDownloadingPdf(true);
    setDownloadPdfError(null);
    try {
      const blob = await downloadLmsOfficialPdf({
        reportId: detail.id,
        operatingBranchId,
      });
      const fileName = `${detail.businessReportNumber}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to download Official PDF.');
      if (parsed.status === 403) {
        setDownloadPdfError(
          'You do not have permission to download Official PDFs (`lms.reports.download`).',
        );
      } else {
        setDownloadPdfError(parsed.message);
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!canView) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        data-testid="report-detail-unauthorized"
      >
        You do not have permission to view LMS Reports (`lms.reports.view`).
      </div>
    );
  }

  const version = detail?.versions.find((v) => v.versionNumber === selectedVersion) ?? null;
  const isDraft = detail?.status === 'Draft';
  const isFinal = detail?.status === 'Final';
  const isReleased = detail?.status === 'Released';

  return (
    <div className="space-y-4" data-testid="report-detail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Report detail</h1>
          <p className="text-sm text-muted-foreground" data-testid="report-detail-honesty">
            Structured snapshot preview. Finalize freezes content. Release is staff-only
            metadata. Official PDF is a separate explicit action after Report Number. Staff
            Official PDF download is available when eligible. No patient publication or
            notification in this slice.
          </p>
        </div>
        <Link
          href="/dashboard/lms/reports"
          className="text-sm text-emerald-700 underline"
          data-testid="report-detail-back"
        >
          Back to Reports
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-slate-50 p-6 text-sm" data-testid="report-detail-loading">
          Loading Report…
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
          data-testid="report-detail-error"
        >
          {error}
        </div>
      ) : null}

      {detail ? (
        <>
          <dl className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2" data-testid="report-detail-meta">
            <div>
              <dt className="text-muted-foreground">Report ID</dt>
              <dd className="font-mono text-xs">{detail.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd data-testid="report-detail-status">{detail.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Order</dt>
              <dd>{detail.orderNumber || detail.orderId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current version</dt>
              <dd data-testid="report-detail-version">{detail.currentVersionNumber}</dd>
            </div>
            {isFinal || isReleased ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Finalized by</dt>
                  <dd className="font-mono text-xs" data-testid="report-finalized-by">
                    {detail.finalizedByUserId || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Finalized at</dt>
                  <dd data-testid="report-finalized-at">
                    {detail.finalizedAtUtc
                      ? new Date(detail.finalizedAtUtc).toLocaleString()
                      : '—'}
                  </dd>
                </div>
              </>
            ) : null}
            {isReleased ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Released by</dt>
                  <dd className="font-mono text-xs" data-testid="report-released-by">
                    {detail.releasedByUserId || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Released at</dt>
                  <dd data-testid="report-released-at">
                    {detail.releasedAtUtc
                      ? new Date(detail.releasedAtUtc).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Report Number</dt>
                  <dd className="font-mono text-sm" data-testid="report-business-number">
                    {detail.businessReportNumber || 'Not assigned'}
                  </dd>
                </div>
                {detail.businessReportNumber ? (
                  <div>
                    <dt className="text-muted-foreground">Number assigned at</dt>
                    <dd data-testid="report-business-number-assigned-at">
                      {detail.businessReportNumberAssignedAtUtc
                        ? new Date(detail.businessReportNumberAssignedAtUtc).toLocaleString()
                        : '—'}
                    </dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>

          {isDraft && canFinalize ? (
            <section className="space-y-3 rounded-lg border p-4" data-testid="report-finalize-panel">
              {!confirmFinalize ? (
                <Button
                  type="button"
                  onClick={() => {
                    setFinalizeError(null);
                    setConfirmFinalize(true);
                  }}
                  data-testid="report-finalize-open"
                >
                  Finalize Report
                </Button>
              ) : (
                <div className="space-y-3" data-testid="report-finalize-confirm">
                  <p className="text-sm">
                    Finalize this Report? Version {detail.currentVersionNumber} will be frozen.
                    Further edits and append are blocked. This does not Release the Report and does
                    not make it patient-visible.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={finalizing}
                      onClick={() => void onFinalize()}
                      data-testid="report-finalize-confirm-submit"
                    >
                      {finalizing ? 'Finalizing…' : 'Confirm Finalize'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={finalizing}
                      onClick={() => setConfirmFinalize(false)}
                      data-testid="report-finalize-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {finalizeError ? (
                <div
                  className="text-sm text-red-700"
                  role="alert"
                  data-testid="report-finalize-error"
                >
                  {finalizeError}
                </div>
              ) : null}
            </section>
          ) : null}

          {isDraft && !canFinalize ? (
            <p className="text-sm text-muted-foreground" data-testid="report-finalize-unauthorized">
              Finalize requires `lms.reports.finalize`.
            </p>
          ) : null}

          {isFinal && canRelease ? (
            <section className="space-y-3 rounded-lg border p-4" data-testid="report-release-panel">
              {!confirmRelease ? (
                <Button
                  type="button"
                  onClick={() => {
                    setReleaseError(null);
                    setConfirmRelease(true);
                  }}
                  data-testid="report-release-open"
                >
                  Release Report
                </Button>
              ) : (
                <div className="space-y-3" data-testid="report-release-confirm">
                  <p className="text-sm">
                    Release this Report? Status will become Released. Version{' '}
                    {detail.currentVersionNumber} remains frozen. This does not generate a PDF,
                    notify patients, or make the Report patient-visible.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={releasing}
                      onClick={() => void onRelease()}
                      data-testid="report-release-confirm-submit"
                    >
                      {releasing ? 'Releasing…' : 'Confirm Release'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={releasing}
                      onClick={() => setConfirmRelease(false)}
                      data-testid="report-release-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {releaseError ? (
                <div
                  className="text-sm text-red-700"
                  role="alert"
                  data-testid="report-release-error"
                >
                  {releaseError}
                </div>
              ) : null}
            </section>
          ) : null}

          {isFinal && !canRelease ? (
            <p className="text-sm text-muted-foreground" data-testid="report-release-unauthorized">
              Release requires `lms.reports.release`.
            </p>
          ) : null}

          {isFinal ? (
            <p className="text-sm text-muted-foreground" data-testid="report-final-frozen">
              This Report is Final. Content is frozen. Append and edit are unavailable.
            </p>
          ) : null}

          {isReleased ? (
            <p className="text-sm text-muted-foreground" data-testid="report-released-frozen">
              This Report is Released. Content remains frozen. Release cannot be repeated.
              Download, publish, and notify are not available in this slice. Report Number and
              Official PDF are separate post-Release actions.
            </p>
          ) : null}

          {isReleased && !detail.businessReportNumber && canAssignNumber ? (
            <section
              className="space-y-3 rounded-lg border p-4"
              data-testid="report-assign-number-panel"
            >
              {!confirmAssignNumber ? (
                <Button
                  type="button"
                  onClick={() => {
                    setAssignNumberError(null);
                    setConfirmAssignNumber(true);
                  }}
                  data-testid="report-assign-number-open"
                >
                  Assign Report Number
                </Button>
              ) : (
                <div className="space-y-3" data-testid="report-assign-number-confirm">
                  <p className="text-sm">
                    Assign an immutable Business Report Number to this Released Report? The number
                    is scoped to the operating branch. This does not generate a PDF or enable
                    download.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={assigningNumber}
                      onClick={() => void onAssignNumber()}
                      data-testid="report-assign-number-confirm-submit"
                    >
                      {assigningNumber ? 'Assigning…' : 'Confirm Assign Number'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={assigningNumber}
                      onClick={() => setConfirmAssignNumber(false)}
                      data-testid="report-assign-number-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {assignNumberError ? (
                <div
                  className="text-sm text-red-700"
                  role="alert"
                  data-testid="report-assign-number-error"
                >
                  {assignNumberError}
                </div>
              ) : null}
            </section>
          ) : null}

          {isReleased && !detail.businessReportNumber && !canAssignNumber ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="report-assign-number-unauthorized"
            >
              Assign Report Number requires `lms.reports.assign_number`.
            </p>
          ) : null}

          {isReleased && detail.businessReportNumber ? (
            <section
              className="space-y-3 rounded-lg border p-4"
              data-testid="report-official-pdf-panel"
            >
              <h2 className="text-sm font-semibold">Official PDF</h2>
              <p className="text-sm text-muted-foreground">
                Explicit staff generation (async). Staff preview and download of the current Official
                PDF when available. Not patient publication.
              </p>

              {(pdfJob || detail.currentOfficialArtifact) && (
                <dl
                  className="grid gap-2 text-sm sm:grid-cols-2"
                  data-testid="report-official-pdf-status"
                >
                  <div>
                    <dt className="text-muted-foreground">Generation status</dt>
                    <dd data-testid="report-official-pdf-job-status">
                      {pdfJob?.status ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Requested at</dt>
                    <dd data-testid="report-official-pdf-requested-at">
                      {pdfJob?.requestedAtUtc
                        ? new Date(pdfJob.requestedAtUtc).toLocaleString()
                        : '—'}
                    </dd>
                  </div>
                  {pdfJob?.failureCode ? (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Failure</dt>
                      <dd data-testid="report-official-pdf-failure">
                        {pdfJob.failureCode}
                        {pdfJob.failureMessage ? `: ${pdfJob.failureMessage}` : ''}
                      </dd>
                    </div>
                  ) : null}
                  {(detail.currentOfficialArtifact || pdfJob?.artifact) && (
                    <>
                      <div>
                        <dt className="text-muted-foreground">Artifact version</dt>
                        <dd data-testid="report-official-pdf-artifact-version">
                          {(detail.currentOfficialArtifact ?? pdfJob?.artifact)?.artifactVersion}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">MIME / size</dt>
                        <dd data-testid="report-official-pdf-artifact-meta">
                          {(detail.currentOfficialArtifact ?? pdfJob?.artifact)?.mimeType} ·{' '}
                          {(detail.currentOfficialArtifact ?? pdfJob?.artifact)?.sizeBytes} bytes
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Content hash</dt>
                        <dd className="font-mono text-xs" data-testid="report-official-pdf-hash">
                          {(detail.currentOfficialArtifact ?? pdfJob?.artifact)?.contentHash ||
                            '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Canonical document</dt>
                        <dd
                          className="font-mono text-xs"
                          data-testid="report-official-pdf-canonical-id"
                        >
                          {(detail.currentOfficialArtifact ?? pdfJob?.artifact)
                            ?.canonicalDocumentId || '—'}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              )}

              {canGenerate ? (
                !confirmGeneratePdf ? (
                  <Button
                    type="button"
                    disabled={
                      generatingPdf ||
                      pdfJob?.status === 'Pending' ||
                      pdfJob?.status === 'Running'
                    }
                    onClick={() => {
                      setGeneratePdfError(null);
                      setConfirmGeneratePdf(true);
                    }}
                    data-testid="report-official-pdf-generate-open"
                  >
                    Generate Official PDF
                  </Button>
                ) : (
                  <div className="space-y-3" data-testid="report-official-pdf-generate-confirm">
                    <p className="text-sm">
                      Request asynchronous Official PDF generation for Report Number{' '}
                      <span className="font-mono">{detail.businessReportNumber}</span>? This does
                      not change Release status or Report Number.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={generatingPdf}
                        onClick={() => void onGenerateOfficialPdf()}
                        data-testid="report-official-pdf-generate-confirm-submit"
                      >
                        {generatingPdf ? 'Requesting…' : 'Confirm Generate'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={generatingPdf}
                        onClick={() => setConfirmGeneratePdf(false)}
                        data-testid="report-official-pdf-generate-cancel"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="report-official-pdf-unauthorized"
                >
                  Generate Official PDF requires `lms.reports.generate`.
                </p>
              )}

              {canDownload && downloadEligible && detail.businessReportNumber ? (
                <div className="flex flex-wrap gap-2">
                  <ReportOfficialPdfPreview
                    reportId={detail.id}
                    operatingBranchId={operatingBranchId}
                    fileName={`${detail.businessReportNumber}.pdf`}
                    disabled={downloadingPdf}
                    triggerTestId="report-official-pdf-preview"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={downloadingPdf}
                    onClick={() => void onDownloadOfficialPdf()}
                    data-testid="report-official-pdf-download"
                  >
                    {downloadingPdf ? 'Downloading…' : 'Download Official PDF'}
                  </Button>
                </div>
              ) : null}

              {canDownload && !downloadEligible && detail.businessReportNumber ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="report-official-pdf-download-unavailable"
                >
                  Preview and Download Official PDF require a Succeeded current Official PDF
                  artifact.
                </p>
              ) : null}

              {!canDownload ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="report-official-pdf-download-unauthorized"
                >
                  Preview and Download Official PDF require `lms.reports.download`.
                </p>
              ) : null}

              {generatePdfError ? (
                <div
                  className="text-sm text-red-700"
                  role="alert"
                  data-testid="report-official-pdf-error"
                >
                  {generatePdfError}
                </div>
              ) : null}

              {downloadPdfError ? (
                <div
                  className="text-sm text-red-700"
                  role="alert"
                  data-testid="report-official-pdf-download-error"
                >
                  {downloadPdfError}
                </div>
              ) : null}
            </section>
          ) : null}

          {isReleased && !detail.businessReportNumber ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="report-official-pdf-number-required"
            >
              Official PDF requires an assigned Business Report Number.
            </p>
          ) : null}

          <div className="space-y-2" data-testid="report-version-history">
            <h2 className="text-sm font-semibold">ReportVersion history</h2>
            <div className="flex flex-wrap gap-2">
              {detail.versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`rounded border px-3 py-1 text-sm ${
                    selectedVersion === v.versionNumber
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200'
                  }`}
                  onClick={() => setSelectedVersion(v.versionNumber)}
                  data-testid={`report-version-${v.versionNumber}`}
                >
                  Version {v.versionNumber}
                </button>
              ))}
            </div>
          </div>

          {version ? (
            <div className="space-y-3 rounded-lg border p-4" data-testid="report-snapshot-preview">
              <h2 className="text-sm font-semibold">
                Snapshot · ReportVersion {version.versionNumber}
              </h2>
              <p className="text-xs text-muted-foreground">
                Created {new Date(version.createdAtUtc).toLocaleString()} · immutable structured
                preview
              </p>
              <ul className="space-y-3">
                {version.sources.map((src) => (
                  <li
                    key={src.id}
                    className="rounded border border-slate-100 bg-slate-50 p-3 text-sm"
                    data-testid={`report-source-${src.resultId}`}
                  >
                    <div className="font-medium">
                      Result {src.resultId.slice(0, 8)}… · ResultVersion {src.resultVersionNumber}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Provenance ResultVersionId: {src.resultVersionId}
                    </div>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      <div>Status at snapshot: {src.resultStatusAtSnapshot}</div>
                      <div>
                        Value:{' '}
                        {src.numericValue ?? src.qualitativeValue ?? '—'}
                        {src.unit ? ` ${src.unit}` : ''}
                      </div>
                      {src.comment ? (
                        <div className="sm:col-span-2">Comment: {src.comment}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
