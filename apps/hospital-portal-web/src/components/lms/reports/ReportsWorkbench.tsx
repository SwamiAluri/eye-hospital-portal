'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHasPermission } from '@/hooks/use-permissions';
import { useBranchContext } from '@/hooks/use-branch-context';
import { LMS_REPORTS_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  createLmsReportDraft,
  downloadLmsOfficialPdf,
  listLmsReportEligibleSources,
  listLmsReports,
  parseLmsReportsApiError,
  type LmsReportEligibleSourceDto,
  type LmsReportListItemDto,
} from '@/lib/lms/lms-reports.api';
import { ReportOfficialPdfPreview } from '@/components/lms/reports/ReportOfficialPdfPreview';

export function ReportsWorkbench() {
  const canView =
    useHasPermission(LMS_REPORTS_PERMISSIONS.view) ||
    useHasPermission(LMS_REPORTS_PERMISSIONS.manage);
  const canManage = useHasPermission(LMS_REPORTS_PERMISSIONS.manage);
  const canDownload = useHasPermission(LMS_REPORTS_PERMISSIONS.download);
  // Authoritative platform branch context (/user-branches/me). Use effective branchId from the hook.
  const {
    branchId: contextBranchId,
    branches,
    branchName,
    selectBranch,
    isLoading: branchesLoading,
    error: branchesError,
  } = useBranchContext();
  const [branchId, setBranchId] = useState(contextBranchId || 'none');
  const [items, setItems] = useState<LmsReportListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState<LmsReportEligibleSourceDto[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (contextBranchId && (branchId === 'none' || !branchId)) {
      setBranchId(contextBranchId);
    }
  }, [contextBranchId, branchId]);

  const onBranchChange = (value: string) => {
    setBranchId(value);
    if (value && value !== 'none') selectBranch(value);
  };

  const contextBranchInList =
    !!contextBranchId && branches.some((b) => b.branchId === contextBranchId);

  const load = useCallback(async () => {
    if (!canView) return;
    if (!branchId || branchId === 'none') {
      setItems([]);
      setTotal(0);
      setError('Select an operating branch to load Reports.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await listLmsReports({
        operatingBranchId: branchId,
        page: 1,
        pageSize: 50,
      });
      setItems(page.items);
      setTotal(page.totalCount);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to load Reports.');
      setError(parsed.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, branchId]);

  const loadEligible = useCallback(async () => {
    if (!canManage || !branchId || branchId === 'none') {
      setEligible([]);
      return;
    }
    setEligibleLoading(true);
    setCreateError(null);
    try {
      const page = await listLmsReportEligibleSources({
        operatingBranchId: branchId,
        page: 1,
        pageSize: 50,
      });
      setEligible(page.items);
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to load eligible Results.');
      setCreateError(parsed.message);
      setEligible([]);
    } finally {
      setEligibleLoading(false);
    }
  }, [canManage, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadEligible();
  }, [loadEligible]);

  const toggleResult = (resultId: string) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  const onCreate = async () => {
    if (!canManage || !branchId || branchId === 'none') return;
    const sources = eligible
      .filter((r) => selectedResultIds.has(r.resultId))
      .map((r) => ({
        resultId: r.resultId,
        resultVersionNumber: r.authorizedVersionNumber,
      }));

    if (sources.length === 0) {
      setCreateError('Select at least one ClinicallyAuthorized Result.');
      return;
    }

    const orderIds = new Set(
      eligible.filter((r) => selectedResultIds.has(r.resultId)).map((r) => r.orderId),
    );
    if (orderIds.size > 1) {
      setCreateError('Selected Results must belong to the same order reporting context.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateOk(null);
    try {
      const created = await createLmsReportDraft({
        operatingBranchId: branchId,
        sources,
      });
      setCreateOk(`Draft Report created (${created.id}). Not Final, Released, or patient-visible.`);
      setSelectedResultIds(new Set());
      await load();
      await loadEligible();
    } catch (e) {
      const parsed = parseLmsReportsApiError(e, 'Failed to create Draft Report.');
      if (parsed.code === 'report_source_already_in_draft') {
        setCreateError(
          'That result is already included in a Draft Report. Refresh the eligible results and try again.',
        );
        await loadEligible();
      } else {
        setCreateError(parsed.message);
      }
    } finally {
      setCreating(false);
    }
  };

  if (!canView) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        data-testid="reports-unauthorized"
      >
        You do not have permission to view LMS Reports (`lms.reports.view`).
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-workbench">
      <div>
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground" data-testid="reports-honesty">
          Draft, Final, and Released Reports. Release is staff-only metadata. Staff may download
          the current Official PDF when eligible. Not patient-visible or notification delivery.
          Clinical Authorization does not create, finalize, or release a Report.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Operating branch</span>
          <Select value={branchId} onValueChange={onBranchChange}>
            <SelectTrigger className="w-[220px]" data-testid="reports-branch-select">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select branch</SelectItem>
              {/* Orders pattern: effective context branch when missing from /user-branches/me list */}
              {contextBranchId && !contextBranchInList ? (
                <SelectItem value={contextBranchId} data-testid="reports-branch-current">
                  {branchName || 'Current branch'}
                </SelectItem>
              ) : null}
              {branches.map((b) => (
                <SelectItem key={b.branchId} value={b.branchId}>
                  {b.branchName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} data-testid="reports-refresh">
          Refresh
        </Button>
      </div>

      {branchesLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="reports-branches-loading">
          Loading authorized branches…
        </p>
      ) : null}

      {branchesError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
          data-testid="reports-branches-error"
        >
          Failed to load authorized branches. Retry or contact an administrator.
        </div>
      ) : null}

      {!branchesLoading &&
      !branchesError &&
      branches.length === 0 &&
      !contextBranchId ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          data-testid="reports-branches-empty"
        >
          No authorized operating branches are available for your account.
        </div>
      ) : null}

      {loading ? (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700"
          data-testid="reports-loading"
        >
          Loading Reports…
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
          data-testid="reports-error"
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground"
          data-testid="reports-empty"
        >
          No Reports for this branch.
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border" data-testid="reports-table">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Draft LMS Reports</caption>
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Report Number</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Sources</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{row.orderNumber || row.orderId}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    data-testid={`reports-number-${row.id}`}
                  >
                    {row.status === 'Released' && row.businessReportNumber
                      ? row.businessReportNumber
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{row.currentVersionNumber}</td>
                  <td className="px-3 py-2">{row.sourceCount}</td>
                  <td className="px-3 py-2">{new Date(row.createdAtUtc).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        className="text-emerald-700 underline"
                        href={`/dashboard/lms/reports/${row.id}?operatingBranchId=${branchId}`}
                        data-testid={`reports-open-${row.id}`}
                      >
                        Open
                      </Link>
                      {canDownload &&
                      row.officialPdfDownloadEligible &&
                      row.businessReportNumber &&
                      branchId &&
                      branchId !== 'none' ? (
                        <ReportOfficialPdfPreview
                          reportId={row.id}
                          operatingBranchId={branchId}
                          fileName={`${row.businessReportNumber}.pdf`}
                          disabled={downloadingId === row.id}
                          triggerVariant="link"
                          triggerLabel="Preview"
                          triggerTestId={`reports-preview-${row.id}`}
                        />
                      ) : null}
                      {canDownload && row.officialPdfDownloadEligible ? (
                        <button
                          type="button"
                          className="text-emerald-700 underline disabled:opacity-50"
                          disabled={downloadingId === row.id || !branchId || branchId === 'none'}
                          data-testid={`reports-download-${row.id}`}
                          onClick={() => {
                            void (async () => {
                              if (!branchId || branchId === 'none' || !row.businessReportNumber)
                                return;
                              setDownloadingId(row.id);
                              setDownloadError(null);
                              try {
                                const blob = await downloadLmsOfficialPdf({
                                  reportId: row.id,
                                  operatingBranchId: branchId,
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${row.businessReportNumber}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                URL.revokeObjectURL(url);
                              } catch (e) {
                                const parsed = parseLmsReportsApiError(
                                  e,
                                  'Failed to download Official PDF.',
                                );
                                setDownloadError(parsed.message);
                              } finally {
                                setDownloadingId(null);
                              }
                            })();
                          }}
                        >
                          {downloadingId === row.id ? 'Downloading…' : 'Download'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {downloadError ? (
            <p
              className="border-t px-3 py-2 text-sm text-red-700"
              role="alert"
              data-testid="reports-download-error"
            >
              {downloadError}
            </p>
          ) : null}
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{total} report(s)</p>
        </div>
      ) : null}

      {canManage ? (
        <section className="space-y-3 rounded-lg border p-4" data-testid="reports-create-panel">
          <h2 className="text-sm font-semibold">Create Draft Report</h2>
          <p className="text-xs text-muted-foreground">
            Explicit create from ClinicallyAuthorized ResultVersions in the same order context.
            Select one or more compatible Results. No PDF, Final, or Release.
          </p>
          {eligibleLoading ? (
            <p className="text-sm text-muted-foreground" data-testid="reports-eligible-loading">
              Loading eligible Results…
            </p>
          ) : null}
          {!eligibleLoading && eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="reports-eligible-empty">
              No ClinicallyAuthorized Results available for this branch.
            </p>
          ) : null}
          {eligible.length > 0 ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto" data-testid="reports-eligible-list">
              {eligible.map((row) => (
                <li key={row.resultId} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`src-${row.resultId}`}
                    checked={selectedResultIds.has(row.resultId)}
                    onChange={() => toggleResult(row.resultId)}
                    data-testid={`reports-select-${row.resultId}`}
                  />
                  <label htmlFor={`src-${row.resultId}`} className="cursor-pointer">
                    <span className="font-medium">{row.testDisplayName}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {row.orderNumber} · v{row.authorizedVersionNumber} ·{' '}
                      {row.patientName || row.patientMrn || row.patientId}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            disabled={creating || selectedResultIds.size === 0}
            onClick={() => void onCreate()}
            data-testid="reports-create-submit"
          >
            {creating ? 'Creating…' : 'Create Draft Report'}
          </Button>
          {createError ? (
            <div className="text-sm text-red-700" role="alert" data-testid="reports-create-error">
              {createError}
            </div>
          ) : null}
          {createOk ? (
            <div className="text-sm text-emerald-800" data-testid="reports-create-success">
              {createOk}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
