'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
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
import {
  listLmsCollectionTasks,
  parseLmsCollectionApiError,
  type LmsCollectionTaskListItemDto,
} from '@/lib/lms/lms-collection.api';
import {
  LMS_COLLECTION_PERMISSIONS,
  LMS_SPECIMENS_PERMISSIONS,
  LMS_VIEW,
} from '@/lib/lms/lms-permissions';
import { CollectionPlanDialog } from './CollectionPlanDialog';
import { CollectionStatusBadge } from './CollectionStatusBadge';
import { CollectionTaskDetailSheet } from './CollectionTaskDetailSheet';

export function CollectionWorkbench() {
  const canView = useHasPermission(LMS_COLLECTION_PERMISSIONS.view);
  const canManage = useHasPermission(LMS_COLLECTION_PERMISSIONS.manage);
  const canCollect = useHasPermission(LMS_COLLECTION_PERMISSIONS.collect);
  const canSpecimensManage = useHasPermission(LMS_SPECIMENS_PERMISSIONS.manage);
  // PO Q1/Q3 — Complete Collection requires manage AND collect
  const canCompleteCollection = canSpecimensManage && canCollect;
  const { branches } = useBranchContext();

  const [items, setItems] = useState<LmsCollectionTaskListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listLmsCollectionTasks({
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        collectionBranchId: branchFilter === 'all' ? undefined : branchFilter,
        page,
        pageSize: 25,
      });
      setItems(result.items);
      setTotal(result.totalCount);
    } catch (e) {
      const err = parseLmsCollectionApiError(e, 'Failed to load collection tasks.');
      setError(err.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, search, status, branchFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const branchLabel = (id: string) =>
    branches.find((b) => b.branchId === id)?.branchName ?? id.slice(0, 8);

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Collection"
        subtitle="Collection planning and shared branch work queue — Complete Collection creates Specimens"
        actions={
          canManage ? (
            <Button
              type="button"
              size="sm"
              data-testid="collection-plan-new"
              onClick={() => setPlanOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Plan collection
            </Button>
          ) : null
        }
      >
        {!canView ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
            data-testid="collection-unauthorized"
          >
            You do not have permission to view LMS collection (`lms.collection.view`).
          </div>
        ) : (
          <div className="space-y-4" data-testid="collection-workbench">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search task number…"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  data-testid="collection-search"
                />
              </div>
              <Select
                value={status}
                onValueChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
              >
                <SelectTrigger className="w-[160px]" data-testid="collection-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="InProgress">InProgress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={branchFilter}
                onValueChange={(v) => {
                  setPage(1);
                  setBranchFilter(v);
                }}
              >
                <SelectTrigger className="w-[200px]" data-testid="collection-branch-filter">
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
                data-testid="collection-refresh"
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Refresh
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground" data-testid="collection-loading">
                Loading collection queue…
              </p>
            ) : error ? (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
                data-testid="collection-error"
              >
                <p className="text-destructive">{error}</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div
                className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
                data-testid="collection-empty"
              >
                No collection tasks match the current filters.
                {canManage ? ' Use Plan collection to create a task from a Submitted order.' : null}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[880px] text-left text-sm" data-testid="collection-table">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Task</th>
                      <th className="px-3 py-2 font-medium">Order</th>
                      <th className="px-3 py-2 font-medium">Patient</th>
                      <th className="px-3 py-2 font-medium">Branch</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Ownership</th>
                      <th className="px-3 py-2 font-medium">Tests</th>
                      <th className="px-3 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                        onClick={() => openDetail(row.id)}
                        data-testid={`collection-row-${row.id}`}
                      >
                        <td className="px-3 py-2 font-medium">{row.taskNumber}</td>
                        <td className="px-3 py-2">{row.orderNumber}</td>
                        <td className="px-3 py-2">
                          <div>{row.patientNameSnapshot ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.patientMrnSnapshot ?? ''}
                          </div>
                        </td>
                        <td className="px-3 py-2">{branchLabel(row.collectionBranchId)}</td>
                        <td className="px-3 py-2">
                          <CollectionStatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 text-xs" data-testid="collection-ownership">
                          {/* PD-COL-OWN-01 — Assigned and Claimed are independently visible */}
                          <div>
                            Assigned:{' '}
                            {row.assignedToUserId
                              ? `${row.assignedToUserId.slice(0, 8)}…`
                              : '—'}
                          </div>
                          <div>
                            Claimed:{' '}
                            {row.claimedByUserId
                              ? `${row.claimedByUserId.slice(0, 8)}…`
                              : 'Unclaimed'}
                          </div>
                        </td>
                        <td className="px-3 py-2">{row.orderTestCount}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
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
          </div>
        )}

        <CollectionPlanDialog
          open={planOpen}
          onOpenChange={setPlanOpen}
          onCreated={(task) => {
            openDetail(task.id);
            void load();
          }}
        />
        <CollectionTaskDetailSheet
          taskId={detailId}
          open={detailOpen}
          canManage={canManage}
          canCollect={canCollect}
          canCompleteCollection={canCompleteCollection}
          onOpenChange={setDetailOpen}
          onChanged={() => void load()}
        />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
