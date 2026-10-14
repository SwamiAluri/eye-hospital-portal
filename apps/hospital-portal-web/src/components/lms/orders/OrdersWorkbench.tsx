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
  listLmsOrders,
  parseLmsOrderApiError,
  type LmsOrderDetailDto,
  type LmsOrderListItemDto,
} from '@/lib/lms/lms-orders.api';
import { LMS_ORDERS_PERMISSIONS, LMS_VIEW } from '@/lib/lms/lms-permissions';
import { OrderComposerDialog, type ComposerMode } from './OrderComposerDialog';
import { OrderDetailSheet } from './OrderDetailSheet';
import { OrderStatusBadge } from './OrderStatusBadge';

export function OrdersWorkbench() {
  const canView = useHasPermission(LMS_ORDERS_PERMISSIONS.view);
  const canCreate = useHasPermission(LMS_ORDERS_PERMISSIONS.create);
  const canManage = useHasPermission(LMS_ORDERS_PERMISSIONS.manage);
  const { branchId, branches } = useBranchContext();

  const [items, setItems] = useState<LmsOrderListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>('create');
  const [composerOrder, setComposerOrder] = useState<LmsOrderDetailDto | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listLmsOrders({
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        operatingBranchId: branchFilter === 'all' ? undefined : branchFilter,
        page,
        pageSize: 25,
      });
      setItems(result.items);
      setTotal(result.totalCount);
    } catch (e) {
      const err = parseLmsOrderApiError(e, 'Failed to load orders.');
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

  const openCreate = () => {
    setComposerMode('create');
    setComposerOrder(null);
    setComposerOpen(true);
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const branchLabel = (id: string) =>
    branches.find((b) => b.branchId === id)?.branchName ?? id.slice(0, 8);

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Orders"
        subtitle="Laboratory order intake — draft, submit, amend, cancel"
        actions={
          canCreate ? (
            <Button type="button" size="sm" data-testid="orders-new" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              New order
            </Button>
          ) : null
        }
      >
        {!canView ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
            data-testid="orders-unauthorized"
          >
            You do not have permission to view LMS orders (`lms.orders.view`).
          </div>
        ) : (
          <div className="space-y-4" data-testid="orders-workbench">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by order number"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  data-testid="orders-search"
                />
              </div>
              <Select
                value={status}
                onValueChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
              >
                <SelectTrigger className="w-full lg:w-40" data-testid="orders-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
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
                <SelectTrigger className="w-full lg:w-48" data-testid="orders-branch-filter">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branchId ? (
                    <SelectItem value={branchId}>Current branch</SelectItem>
                  ) : null}
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
                size="icon"
                aria-label="Refresh orders"
                onClick={() => void load()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground" data-testid="orders-loading">
                Loading orders…
              </p>
            ) : null}

            {error ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
                role="alert"
                data-testid="orders-error"
              >
                {error}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-3"
                  onClick={() => void load()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <div
                className="rounded-lg border border-dashed p-10 text-center"
                data-testid="orders-empty"
              >
                <p className="text-sm font-medium">No orders found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canCreate
                    ? 'Create a draft order to begin laboratory intake.'
                    : 'No orders match the current filters.'}
                </p>
                {canCreate ? (
                  <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
                    New order
                  </Button>
                ) : null}
              </div>
            ) : null}

            {!loading && items.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border" data-testid="orders-table">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Order #</th>
                      <th className="px-3 py-2 font-medium">Patient</th>
                      <th className="px-3 py-2 font-medium">Priority</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Branch</th>
                      <th className="px-3 py-2 font-medium">Created</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium tabular-nums">{row.orderNumber}</td>
                        <td className="px-3 py-2">
                          {row.patientNameSnapshot || (
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.patientId.slice(0, 8)}…
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{row.priority}</td>
                        <td className="px-3 py-2">
                          <OrderStatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 text-xs">{branchLabel(row.operatingBranchId)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetail(row.id)}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

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

        <OrderComposerDialog
          open={composerOpen}
          mode={composerMode}
          order={composerOrder}
          onOpenChange={setComposerOpen}
          onSaved={(detail) => {
            void load();
            setDetailId(detail.id);
            setDetailOpen(true);
          }}
        />

        <OrderDetailSheet
          orderId={detailId}
          open={detailOpen}
          canCreate={canCreate}
          canManage={canManage}
          onOpenChange={setDetailOpen}
          onEditDraft={(order) => {
            setComposerMode('edit');
            setComposerOrder(order);
            setComposerOpen(true);
          }}
          onAmend={(order) => {
            setComposerMode('amend');
            setComposerOrder(order);
            setComposerOpen(true);
          }}
          onChanged={() => void load()}
        />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
