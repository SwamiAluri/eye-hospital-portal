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
import { LMS_SPECIMENS_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  listLmsSpecimens,
  parseLmsSpecimenApiError,
  type LmsSpecimenListItemDto,
} from '@/lib/lms/lms-specimens.api';
import { ReceiveSpecimenDialog } from '@/components/lms/specimens/ReceiveSpecimenDialog';
import { RejectSpecimenDialog } from '@/components/lms/specimens/RejectSpecimenDialog';

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'Received'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : status === 'Rejected'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-slate-200 bg-slate-50 text-slate-800';
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${tone}`} data-testid="specimen-status-badge">
      {status}
    </span>
  );
}

export function SpecimenWorkbench() {
  const router = useRouter();
  const { branches } = useBranchContext();
  const canView =
    useHasPermission(LMS_SPECIMENS_PERMISSIONS.view) ||
    useHasPermission(LMS_SPECIMENS_PERMISSIONS.manage);
  const canReceive = useHasPermission(LMS_SPECIMENS_PERMISSIONS.receive);

  const [items, setItems] = useState<LmsSpecimenListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listLmsSpecimens({
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        collectionBranchId: branchFilter === 'all' ? undefined : branchFilter,
        page,
        pageSize: 25,
      });
      setItems(result.items);
      setTotal(result.totalCount);
    } catch (e) {
      setError(parseLmsSpecimenApiError(e, 'Failed to load specimens.').message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, search, status, branchFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const branchLabel = (id: string) =>
    branches.find((b) => b.branchId === id)?.branchName ?? id;

  if (!canView) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        data-testid="specimens-unauthorized"
      >
        You do not have permission to view LMS specimens (`lms.specimens.view` or
        `lms.specimens.manage`).
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="specimen-workbench">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search MRN, name, accession, or specimen ID…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            data-testid="specimen-search"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-[160px]" data-testid="specimen-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Collected">Collected</SelectItem>
            <SelectItem value="Received">Received</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={branchFilter}
          onValueChange={(v) => {
            setPage(1);
            setBranchFilter(v);
          }}
        >
          <SelectTrigger className="w-[200px]" data-testid="specimen-branch-filter">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.branchId} value={b.branchId}>
                {b.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          data-testid="specimen-refresh"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground" data-testid="specimen-loading">
          Loading specimen queue…
        </p>
      ) : error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
          data-testid="specimen-error"
        >
          <p className="text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          data-testid="specimen-empty"
        >
          No specimens match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-left text-sm" data-testid="specimen-table">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Specimen</th>
                <th className="px-3 py-2 font-medium">Accession</th>
                <th className="px-3 py-2 font-medium">MRN</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Collected</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const eligible = row.status === 'Collected';
                return (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                    data-testid={`specimen-row-${row.id}`}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                        onClick={() => router.push(`/dashboard/lms/specimens/${row.id}`)}
                        data-testid={`specimen-open-${row.id}`}
                      >
                        {row.id.slice(0, 8)}…
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" data-testid="specimen-accession-cell">
                      {row.accession ?? '—'}
                    </td>
                    <td className="px-3 py-2">{row.patientMrnSnapshot ?? '—'}</td>
                    <td className="px-3 py-2">{row.patientNameSnapshot ?? '—'}</td>
                    <td className="px-3 py-2">{row.orderNumber}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(row.collectedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{branchLabel(row.collectionBranchId)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {canReceive && eligible ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              data-testid={`specimen-receive-${row.id}`}
                              onClick={() => setReceiveId(row.id)}
                            >
                              Receive
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-testid={`specimen-reject-${row.id}`}
                              onClick={() => setRejectId(row.id)}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 25 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} · {total} total
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
      ) : null}

      {receiveId ? (
        <ReceiveSpecimenDialog
          specimenId={receiveId}
          open={!!receiveId}
          onOpenChange={(open) => {
            if (!open) setReceiveId(null);
          }}
          onSuccess={() => {
            setReceiveId(null);
            void load();
          }}
        />
      ) : null}
      {rejectId ? (
        <RejectSpecimenDialog
          specimenId={rejectId}
          open={!!rejectId}
          onOpenChange={(open) => {
            if (!open) setRejectId(null);
          }}
          onSuccess={() => {
            setRejectId(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
