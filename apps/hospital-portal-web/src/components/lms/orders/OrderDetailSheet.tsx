'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  cancelLmsOrder,
  getLmsOrder,
  getLmsOrderVersions,
  newLmsIdempotencyKey,
  parseLmsOrderApiError,
  submitLmsOrder,
  type LmsOrderDetailDto,
  type LmsOrderVersionDto,
} from '@/lib/lms/lms-orders.api';
import { OrderStatusBadge } from './OrderStatusBadge';

type Props = {
  orderId: string | null;
  open: boolean;
  canCreate: boolean;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDraft: (order: LmsOrderDetailDto) => void;
  onAmend: (order: LmsOrderDetailDto) => void;
  onChanged: () => void;
};

export function OrderDetailSheet({
  orderId,
  open,
  canCreate,
  canManage,
  onOpenChange,
  onEditDraft,
  onAmend,
  onChanged,
}: Props) {
  const [detail, setDetail] = useState<LmsOrderDetailDto | null>(null);
  const [versions, setVersions] = useState<LmsOrderVersionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cancelIdemRef = useRef<string | null>(null);
  const submitIdemRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, v] = await Promise.all([getLmsOrder(orderId), getLmsOrderVersions(orderId)]);
      setDetail(d);
      setVersions(v);
    } catch (e) {
      setError(parseLmsOrderApiError(e, 'Failed to load order.').message);
      setDetail(null);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (open && orderId) {
      cancelIdemRef.current = null;
      submitIdemRef.current = null;
      setCancelOpen(false);
      setCancelReason('');
      void load();
    }
  }, [open, orderId, load]);

  const v = detail?.currentVersion;

  const onSubmit = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      if (!submitIdemRef.current) submitIdemRef.current = newLmsIdempotencyKey();
      const next = await submitLmsOrder(detail.id, detail.rowVersion, submitIdemRef.current);
      setDetail(next);
      const vers = await getLmsOrderVersions(detail.id);
      setVersions(vers);
      toast.success(`Order ${next.orderNumber} submitted`);
      onChanged();
    } catch (e) {
      const err = parseLmsOrderApiError(e);
      toast.error(err.message);
      if (err.isConcurrencyConflict) void load();
    } finally {
      setBusy(false);
    }
  };

  const onCancelConfirm = async () => {
    if (!detail || !cancelReason.trim()) {
      toast.error('Cancel reason is required.');
      return;
    }
    setBusy(true);
    try {
      if (!cancelIdemRef.current) cancelIdemRef.current = newLmsIdempotencyKey();
      const next = await cancelLmsOrder(
        detail.id,
        detail.rowVersion,
        cancelReason.trim(),
        cancelIdemRef.current,
      );
      setDetail(next);
      setCancelOpen(false);
      toast.success('Order cancelled');
      onChanged();
    } catch (e) {
      const err = parseLmsOrderApiError(e);
      toast.error(err.message);
      if (err.isConcurrencyConflict) {
        toast.error('This order was changed by another action. Refresh to continue.');
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
        data-testid="order-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <span>{detail?.orderNumber ?? 'Order'}</span>
            {detail ? <OrderStatusBadge status={detail.status} /> : null}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground" data-testid="order-detail-loading">
              Loading order…
            </p>
          ) : null}
          {error ? (
            <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive" role="alert">
              {error}
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : null}

          {detail && v ? (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Patient</dt>
                  <dd data-testid="detail-patient">
                    {v.patientNameSnapshot || '—'}
                    {v.patientMrnSnapshot ? (
                      <span className="text-muted-foreground"> · {v.patientMrnSnapshot}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Visit</dt>
                  <dd>{v.visitId ? 'Linked' : 'None'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ordering provider</dt>
                  <dd>{v.orderingProviderNameSnapshot || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Responsible clinician</dt>
                  <dd>{v.responsibleClinicianNameSnapshot || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{v.orderSource}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd>
                    {v.priority}
                    {v.priorityReason ? ` — ${v.priorityReason}` : ''}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Indication</dt>
                  <dd>{v.clinicalIndication}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Operating branch</dt>
                  <dd className="font-mono text-xs">{detail.operatingBranchId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Performing branch</dt>
                  <dd className="font-mono text-xs">{v.performingBranchId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd>v{detail.currentVersionNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Row version</dt>
                  <dd>{detail.rowVersion}</dd>
                </div>
                {detail.cancelReason ? (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Cancel reason</dt>
                    <dd>{detail.cancelReason}</dd>
                  </div>
                ) : null}
              </dl>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Selections</h4>
                <ul className="space-y-1 text-sm" data-testid="detail-selections">
                  {v.selections.map((s) => (
                    <li key={s.id} className="rounded border px-2 py-1.5">
                      {s.displayNameSnapshot || s.catalogueItemId}
                      <span className="text-muted-foreground">
                        {' '}
                        · {s.catalogueType}
                        {s.catalogueVersionId
                          ? ` · ver ${s.catalogueVersionId.slice(0, 8)}…`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Order tests</h4>
                {v.tests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {detail.status === 'Draft'
                      ? 'Tests are created on submit (panel explosion).'
                      : 'No tests on this version.'}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm" data-testid="detail-tests">
                    {v.tests.map((t) => (
                      <li key={t.id} className="rounded border px-2 py-1.5">
                        <span className="font-medium">{t.displayNameSnapshot}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {t.internalOrderCodeSnapshot} · {t.status}
                          {t.panelCatalogueItemId ? ' · panel component' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div data-testid="order-version-history">
                <h4 className="mb-2 text-sm font-semibold">Version history</h4>
                <ol className="space-y-2 border-l-2 border-muted pl-3">
                  {versions.map((ver) => (
                    <li key={ver.id} className="text-sm">
                      <p className="font-medium">
                        Version {ver.versionNumber}
                        {ver.amendmentReason ? ' — Amendment' : ver.submittedAt ? ' — Submitted' : ' — Draft'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ver.submittedAt
                          ? new Date(ver.submittedAt).toLocaleString()
                          : new Date(ver.createdAt).toLocaleString()}
                      </p>
                      {ver.amendmentReason ? (
                        <p className="text-xs">Reason: {ver.amendmentReason}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                {detail.status === 'Draft' && canCreate ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      data-testid="detail-edit-draft"
                      onClick={() => onEditDraft(detail)}
                    >
                      Edit draft
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      data-testid="detail-submit"
                      onClick={() => void onSubmit()}
                    >
                      Submit
                    </Button>
                  </>
                ) : null}
                {detail.status === 'Submitted' && canManage ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    data-testid="detail-amend"
                    onClick={() => onAmend(detail)}
                  >
                    Amend
                  </Button>
                ) : null}
                {(detail.status === 'Draft' || detail.status === 'Submitted') && canManage ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    data-testid="detail-cancel"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel order
                  </Button>
                ) : null}
                <Button type="button" variant="outline" disabled={busy} onClick={() => void load()}>
                  Refresh
                </Button>
              </div>

              {cancelOpen ? (
                <div
                  className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
                  data-testid="cancel-panel"
                >
                  <Label htmlFor="cancel-reason">Cancel reason</Label>
                  <Textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onCancelConfirm()}
                    >
                      Confirm cancel
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setCancelOpen(false)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
