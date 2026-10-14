'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Plus, RefreshCw, Search, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHasPermission } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { labReportsApi, type LabReport } from '@/lib/api/lab-reports.api';
import { LaboratoryOrderDialog } from '@/components/laboratory/LaboratoryOrderDialog';
import { LaboratoryCatalogAdminDialog } from '@/components/laboratory/LaboratoryCatalogAdminDialog';
import {
  LAB_PRIORITY_CHIP_CLASS,
  LAB_REPORT_PRIORITIES,
  LAB_REPORT_STATUSES,
  LAB_STATUS_CHIP_CLASS,
  labStatusLabel,
  LAB_REPORT_PRIORITY_LABELS,
} from '@/components/laboratory/laboratory-constants';

function formatOrderedAt(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WorklistSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-2 p-2" data-testid="laboratory-worklist-loading">
      <span className="sr-only">Loading laboratory orders</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

export function LaboratoryWorkbench() {
  const canCreate = useHasPermission('patient.update');
  const canReadReports = useHasPermission('patient.view');

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [rows, setRows] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [catalogAdminOpen, setCatalogAdminOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canReadReports) {
      setLoading(false);
      setRows([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await labReportsApi.list({
        status: status || undefined,
        priority: priority || undefined,
        search: debouncedSearch.trim() || undefined,
        take: 100,
      });
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      setRows([]);
      setError(getApiErrorMessage(err) || 'Laboratory orders are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [canReadReports, status, priority, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearFilters = () => {
    setSearchInput('');
    setStatus('');
    setPriority('');
  };

  const onCreated = () => {
    void load();
  };

  return (
    <div className="space-y-4" data-testid="laboratory-workbench">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            <TestTube className="h-7 w-7 text-primary-600" aria-hidden />
            Laboratory Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">Pathology laboratory work queue</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || !canReadReports}
            aria-label="Refresh worklist"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
          {canCreate && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCatalogAdminOpen(true)}
                data-testid="laboratory-catalog-admin-open"
              >
                Catalog admin
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setOrderOpen(true)}
                data-testid="laboratory-order-new-test"
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Order New Test
              </Button>
            </>
          )}
        </div>
      </div>

      {!canReadReports ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          role="status"
          data-testid="laboratory-permission-denied"
        >
          Laboratory orders require patient view permission. Contact an administrator if you need access.
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
            data-testid="laboratory-filters"
          >
            <div className="relative min-w-[14rem] flex-1">
              <Labelish htmlFor="lab-worklist-search">Search</Labelish>
              <Search className="pointer-events-none absolute left-3 top-[2.05rem] h-4 w-4 text-gray-400" />
              <Input
                id="lab-worklist-search"
                type="search"
                className="pl-9"
                placeholder="Patient, MRN, or test"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                data-testid="laboratory-search"
              />
            </div>
            <div className="w-44">
              <Labelish htmlFor="lab-worklist-status">Status</Labelish>
              <select
                id="lab-worklist-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                data-testid="laboratory-status-filter"
              >
                <option value="">All statuses</option>
                {LAB_REPORT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <Labelish htmlFor="lab-worklist-priority">Priority</Labelish>
              <select
                id="lab-worklist-priority"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                data-testid="laboratory-priority-filter"
              >
                <option value="">All</option>
                {LAB_REPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {LAB_REPORT_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {loading ? (
              <WorklistSkeleton />
            ) : error ? (
              <div
                className="flex items-start gap-3 p-6 text-sm text-red-800"
                role="alert"
                data-testid="laboratory-worklist-error"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">Unable to load laboratory orders</p>
                  <p className="mt-1">{error}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6" data-testid="laboratory-worklist-empty">
                <EmptyState
                  icon={<TestTube className="h-10 w-10" aria-hidden />}
                  title="No laboratory orders found"
                  description="There are no LabReport records matching the current filters."
                  action={
                    canCreate
                      ? {
                          label: 'Order New Test',
                          onClick: () => setOrderOpen(true),
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto" data-testid="laboratory-worklist-table">
                <table className="min-w-full text-left text-sm" aria-label="Laboratory work queue">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Patient
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Test
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Category
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Priority
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Ordered
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Orderer
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="staff-worklist-row border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                        data-testid="laboratory-worklist-row"
                      >
                        <td className="px-3 py-2.5 align-top">
                          <div className="font-medium text-gray-900">
                            {row.patientDisplayName || '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            MRN {row.medicalRecordNumber || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <div className="font-medium text-gray-900">{row.testName}</div>
                          {row.testCode ? (
                            <div className="text-xs text-slate-500" data-testid="laboratory-worklist-test-code">
                              {row.testCode}
                            </div>
                          ) : null}
                          {row.specimenType ? (
                            <div className="text-xs text-slate-500">Specimen: {row.specimenType}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 align-top text-slate-700">
                          {row.testCategory || '—'}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              LAB_PRIORITY_CHIP_CLASS[row.priority] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {LAB_REPORT_PRIORITY_LABELS[
                              row.priority as (typeof LAB_REPORT_PRIORITIES)[number]
                            ] ?? row.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              LAB_STATUS_CHIP_CLASS[row.status] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {labStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap text-slate-700">
                          {formatOrderedAt(row.orderedAt ?? row.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 align-top text-slate-700">
                          {row.orderedByName || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <LaboratoryOrderDialog open={orderOpen} onOpenChange={setOrderOpen} onCreated={onCreated} />
      <LaboratoryCatalogAdminDialog open={catalogAdminOpen} onOpenChange={setCatalogAdminOpen} />
    </div>
  );
}

function Labelish({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600">
      {children}
    </label>
  );
}
