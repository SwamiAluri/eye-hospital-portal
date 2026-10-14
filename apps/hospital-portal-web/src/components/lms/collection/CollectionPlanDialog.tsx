'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchContext } from '@/hooks/use-branch-context';
import { listLmsOrders } from '@/lib/lms/lms-orders.api';
import {
  createLmsCollectionTask,
  getLmsCollectionPlanContext,
  newLmsIdempotencyKey,
  parseLmsCollectionApiError,
  type LmsCollectionPlanContextDto,
  type LmsCollectionTaskDetailDto,
} from '@/lib/lms/lms-collection.api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (task: LmsCollectionTaskDetailDto) => void;
};

export function CollectionPlanDialog({ open, onOpenChange, onCreated }: Props) {
  const { branchId, branches } = useBranchContext();
  const [orderSearch, setOrderSearch] = useState('');
  const [orderOptions, setOrderOptions] = useState<{ id: string; orderNumber: string }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [ctx, setCtx] = useState<LmsCollectionPlanContextDto | null>(null);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [collectionBranchId, setCollectionBranchId] = useState('');
  const [locationText, setLocationText] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedOrderId('');
    setCtx(null);
    setSelectedTests(new Set());
    setLocationText('');
    setNotes('');
    setError(null);
    setCollectionBranchId(branchId ?? '');
  }, [open, branchId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingOrders(true);
      try {
        const result = await listLmsOrders({
          status: 'Submitted',
          search: orderSearch.trim() || undefined,
          page: 1,
          pageSize: 25,
        });
        if (!cancelled) {
          setOrderOptions(result.items.map((o) => ({ id: o.id, orderNumber: o.orderNumber })));
        }
      } catch {
        if (!cancelled) setOrderOptions([]);
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderSearch]);

  useEffect(() => {
    if (!selectedOrderId) {
      setCtx(null);
      setSelectedTests(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCtx(true);
      setError(null);
      try {
        const plan = await getLmsCollectionPlanContext(selectedOrderId);
        if (!cancelled) {
          setCtx(plan);
          setSelectedTests(new Set());
          if (!collectionBranchId) setCollectionBranchId(plan.operatingBranchId);
        }
      } catch (e) {
        const err = parseLmsCollectionApiError(e, 'Failed to load plan context.');
        if (!cancelled) {
          setCtx(null);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoadingCtx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTest = (id: string, alreadyPlanned: boolean) => {
    if (alreadyPlanned) return;
    setSelectedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!selectedOrderId || !collectionBranchId || selectedTests.size === 0) {
      setError('Select a submitted order, collection branch, and at least one OrderTest.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await createLmsCollectionTask({
        orderId: selectedOrderId,
        collectionBranchId,
        orderTestIds: Array.from(selectedTests),
        locationText: locationText.trim() || null,
        notes: notes.trim() || null,
        idempotencyKey: newLmsIdempotencyKey(),
      });
      toast.success(`Collection task ${task.taskNumber} created.`);
      onCreated(task);
      onOpenChange(false);
    } catch (e) {
      const err = parseLmsCollectionApiError(e, 'Failed to create collection task.');
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="collection-plan-dialog">
        <DialogHeader>
          <DialogTitle>Collection planning</DialogTitle>
          <DialogDescription>
            Explicitly select OrderTests for a Submitted order. Tasks are not auto-derived from
            catalogue specimen or container metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="col-order-search">Submitted order</Label>
            <Input
              id="col-order-search"
              placeholder="Search order number…"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              data-testid="collection-plan-order-search"
            />
            <Select value={selectedOrderId || undefined} onValueChange={setSelectedOrderId}>
              <SelectTrigger data-testid="collection-plan-order-select">
                <SelectValue placeholder={loadingOrders ? 'Loading…' : 'Select submitted order'} />
              </SelectTrigger>
              <SelectContent>
                {orderOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingCtx ? (
            <p className="text-sm text-muted-foreground">Loading order context…</p>
          ) : ctx ? (
            <div className="space-y-3 rounded-md border p-3" data-testid="collection-plan-context">
              <div className="text-sm">
                <div className="font-medium">{ctx.patientNameSnapshot ?? 'Patient'}</div>
                <div className="text-muted-foreground">
                  MRN {ctx.patientMrnSnapshot ?? '—'} · Order {ctx.orderNumber} · {ctx.orderStatus}
                </div>
              </div>
              <div className="space-y-2">
                <Label>OrderTests (planner-controlled grouping)</Label>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
                  {ctx.orderTests.map((t) => {
                    const checked = selectedTests.has(t.orderTestId);
                    return (
                      <li key={t.orderTestId}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm ${
                            t.alreadyPlanned ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={t.alreadyPlanned}
                            checked={checked}
                            onChange={() => toggleTest(t.orderTestId, t.alreadyPlanned)}
                            data-testid={`collection-plan-test-${t.orderTestId}`}
                          />
                          <span>
                            <span className="font-medium">{t.displayNameSnapshot}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              ({t.internalOrderCodeSnapshot}) · {t.status}
                              {t.alreadyPlanned ? ' · already planned' : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Collection branch</Label>
              <Select value={collectionBranchId || undefined} onValueChange={setCollectionBranchId}>
                <SelectTrigger data-testid="collection-plan-branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.branchId} value={b.branchId}>
                      {b.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-location">Location text (optional)</Label>
              <Input
                id="col-location"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. Phlebotomy bay"
                data-testid="collection-plan-location"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="col-notes">Notes (optional)</Label>
            <Input
              id="col-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="collection-plan-notes"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" data-testid="collection-plan-error">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            data-testid="collection-plan-submit"
          >
            {submitting ? 'Creating…' : 'Create collection task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
