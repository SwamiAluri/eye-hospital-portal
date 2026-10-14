'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHasPermission } from '@/hooks/use-permissions';
import { useBranchContext } from '@/hooks/use-branch-context';
import { LMS_CRITICAL_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  listLmsCriticalWorkQueue,
  parseLmsTestingApiError,
  type LmsCriticalWorkQueueItemDto,
} from '@/lib/lms/lms-testing.api';

export function CriticalWorkbench() {
  const canView =
    useHasPermission(LMS_CRITICAL_PERMISSIONS.view) ||
    useHasPermission(LMS_CRITICAL_PERMISSIONS.manage) ||
    useHasPermission(LMS_CRITICAL_PERMISSIONS.acknowledge);
  const { branches, selectedBranchId } = useBranchContext();
  const [branchId, setBranchId] = useState(selectedBranchId || 'none');
  const [status, setStatus] = useState<'Open' | 'Acknowledged' | 'all'>('Open');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<LmsCriticalWorkQueueItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBranchId && branchId === 'none') setBranchId(selectedBranchId);
  }, [selectedBranchId, branchId]);

  const load = useCallback(async () => {
    if (!canView) return;
    if (!branchId || branchId === 'none') {
      setItems([]);
      setTotal(0);
      setError('Select an operating branch to load the Critical Results queue.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await listLmsCriticalWorkQueue({
        operatingBranchId: branchId,
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
        page: 1,
        pageSize: 50,
      });
      setItems(page.items);
      setTotal(page.totalCount);
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Failed to load Critical work queue.');
      setError(parsed.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, branchId, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        data-testid="critical-queue-unauthorized"
      >
        You do not have permission to view Critical Results (`lms.results.critical.view`).
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="critical-workbench">
      <div>
        <h1 className="text-lg font-semibold">Critical Results</h1>
        <p className="text-sm text-muted-foreground" data-testid="critical-queue-honesty">
          Event-backed safety queue. Critical is not Result status, Final, Released, or patient-visible.
          No fake rows or KPI tiles.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Operating branch</span>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-[220px]" data-testid="critical-branch-select">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select branch</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.branchId} value={b.branchId}>
                  {b.branchName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="critical-status-filter">
            Event status
          </label>
          <select
            id="critical-status-filter"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Open' | 'Acknowledged' | 'all')}
            data-testid="critical-status-filter"
          >
            <option value="Open">Open</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="critical-search">
            Search
          </label>
          <Input
            id="critical-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order / test / result id"
            data-testid="critical-search"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} data-testid="critical-refresh">
          Refresh
        </Button>
      </div>

      {error && (
        <div
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          role="alert"
          data-testid="critical-queue-error"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" data-testid="critical-queue-table">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Result status</th>
              <th className="px-3 py-2">Critical</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Classified (UTC)</th>
              <th className="px-3 py-2">Ack (UTC)</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-muted-foreground" data-testid="critical-queue-loading">
                  Loading Critical events…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-muted-foreground" data-testid="critical-queue-empty">
                  No Critical events for this branch/filter.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((row) => (
                <tr key={row.criticalEventId} className="border-b last:border-0" data-testid="critical-queue-row">
                  <td className="px-3 py-2">
                    {row.patientName || '—'}
                    <div className="text-xs text-muted-foreground">{row.patientMrn || row.patientId}</div>
                  </td>
                  <td className="px-3 py-2">{row.orderNumber}</td>
                  <td className="px-3 py-2">
                    {row.testDisplayName}
                    <div className="text-xs text-muted-foreground">{row.internalOrderCode}</div>
                  </td>
                  <td className="px-3 py-2" data-testid="critical-row-result-status">
                    {row.resultStatus}
                  </td>
                  <td className="px-3 py-2" data-testid="critical-row-critical-status">
                    {row.criticalStatus}
                  </td>
                  <td className="px-3 py-2">{row.resultVersionNumber}</td>
                  <td className="px-3 py-2">{row.classifiedAtUtc}</td>
                  <td className="px-3 py-2">{row.acknowledgedAtUtc || '—'}</td>
                  <td className="px-3 py-2">
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      href={`/dashboard/lms/testing/manual-results?orderTestId=${row.orderTestId}&specimenId=${row.specimenId}&operatingBranchId=${branchId}`}
                      data-testid="critical-row-open"
                    >
                      Open result
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="critical-queue-count">
        {total} event{total === 1 ? '' : 's'}
      </p>
    </div>
  );
}
