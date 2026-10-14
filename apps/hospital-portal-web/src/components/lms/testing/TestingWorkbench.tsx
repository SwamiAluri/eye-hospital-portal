'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useHasPermission } from '@/hooks/use-permissions';
import { LMS_RESULTS_PERMISSIONS, LMS_TESTING_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  listLmsTestingWorkQueue,
  parseLmsTestingApiError,
  type LmsTestingWorkQueueItemDto,
} from '@/lib/lms/lms-testing.api';
import { testingWorkQueuePrimaryAction } from '@/lib/lms/testing-work-queue-actions';

export function TestingWorkbench(props?: {
  /** When set, filters work queue by Result status (e.g. Draft / TechnicalVerified). */
  resultStatus?: string;
  title?: string;
}) {
  const router = useRouter();
  const { branches, selectedBranchId } = useBranchContext();
  const canView =
    useHasPermission(LMS_TESTING_PERMISSIONS.view) ||
    useHasPermission(LMS_TESTING_PERMISSIONS.manage) ||
    useHasPermission(LMS_TESTING_PERMISSIONS.result) ||
    useHasPermission(LMS_TESTING_PERMISSIONS.verify) ||
    useHasPermission(LMS_RESULTS_PERMISSIONS.authorize);

  const [items, setItems] = useState<LmsTestingWorkQueueItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState(selectedBranchId || 'none');

  useEffect(() => {
    if (selectedBranchId && branchId === 'none') setBranchId(selectedBranchId);
  }, [selectedBranchId, branchId]);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (!branchId || branchId === 'none') {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError('Select an operating branch to load the Testing work queue.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listLmsTestingWorkQueue({
        operatingBranchId: branchId,
        search: search.trim() || undefined,
        resultStatus: props?.resultStatus,
        page,
        pageSize: 25,
      });
      setItems(result.items);
      setTotal(result.totalCount);
    } catch (e) {
      setError(parseLmsTestingApiError(e, 'Failed to load Testing work queue.').message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, branchId, search, page, props?.resultStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        data-testid="testing-unauthorized"
      >
        You do not have permission to view LMS Testing (`lms.testing.view`, `lms.testing.manage`,
        `lms.testing.result`, `lms.testing.verify`, or `lms.results.authorize`).
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="testing-workbench">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search order, MRN, name, accession, or test…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            data-testid="testing-search"
          />
        </div>
        <Select
          value={branchId}
          onValueChange={(v) => {
            setPage(1);
            setBranchId(v);
          }}
        >
          <SelectTrigger className="w-full lg:w-64" data-testid="testing-branch-filter">
            <SelectValue placeholder="Operating branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select branch…</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.branchId} value={b.branchId}>
                {b.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => void load()} data-testid="testing-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Eligible work: Submitted orders · Ordered tests · Received specimens · local catalogue only.
        Barcode optional. Result Draft status only — not a released clinical result.
      </p>

      {loading && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground" data-testid="testing-loading">
          Loading Testing work queue…
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          data-testid="testing-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div
          className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          data-testid="testing-empty"
        >
          No eligible Testing work items for this branch.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border" data-testid="testing-table">
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">LMS Testing work queue</caption>
            <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Test</th>
                <th className="px-3 py-2 font-medium">Specimen</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Draft</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const primaryAction = testingWorkQueuePrimaryAction(row);
                return (
                <tr
                  key={`${row.orderTestId}-${row.specimenId}`}
                  className="border-b last:border-0"
                  data-testid="testing-row"
                >
                  <td className="px-3 py-2 font-medium">{row.orderNumber}</td>
                  <td className="px-3 py-2">
                    <div>{row.patientName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{row.patientMrn || row.patientId}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.testDisplayName}</div>
                    <div className="text-xs text-muted-foreground">{row.internalOrderCode}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.accession || 'No accession'}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.barcodeValue ? `Barcode ${row.barcodeValue}` : 'Barcode optional'}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.priority || '—'}</td>
                  <td className="px-3 py-2">
                    {row.resultStatus ? (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs">
                        {row.resultStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {primaryAction ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid="testing-open-draft"
                        data-action-kind={primaryAction.kind}
                        onClick={() =>
                          router.push(
                            `/dashboard/lms/testing/manual-results?orderTestId=${row.orderTestId}&specimenId=${row.specimenId}&operatingBranchId=${branchId}`,
                          )
                        }
                      >
                        {primaryAction.label}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground" data-testid="testing-no-draft-action">
                        Not editable
                      </span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 25 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} · {total} eligible item(s)
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
