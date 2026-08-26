'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { formatInr } from '@/lib/billing/group-bill-items';
import { opdBillingApi } from '@/lib/api/opd-billing.api';
import { flattenCatalog, serviceCatalogApi, type FlatVariantDto } from '@/lib/api/service-catalog.api';
import { axiosMessage } from '@/lib/ip-management/collect-payment';
import {
  ADD_ITEM_TEST_IDS as T,
  buildAddBillItemRequest,
  previewItemAmount,
  reuseOrCreateBillItemKey,
} from '@/lib/billing/workstation-mutations';

export function AddBillItemDialog({
  open,
  onOpenChange,
  opdBillId,
  billNumber,
  currentNet,
  currentDue,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opdBillId: string;
  billNumber: string;
  currentNet: number;
  currentDue: number;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [variants, setVariants] = useState<FlatVariantDto[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selected, setSelected] = useState<FlatVariantDto | null>(null);
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(null);
    setQty('1');
    setError(null);
    setCatalogError(null);
    setIdempotencyKey((current) => reuseOrCreateBillItemKey(current, opdBillId));
    let cancelled = false;
    setCatalogLoading(true);
    serviceCatalogApi.getFullCatalog()
      .then((catalog) => {
        if (!cancelled) setVariants(flattenCatalog(catalog).filter((v) => v.isActive));
      })
      .catch((err: unknown) => {
        if (!cancelled) setCatalogError(axiosMessage(err) || 'Could not load the service catalog.');
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, opdBillId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return variants.slice(0, 40);
    return variants
      .filter((v) =>
        `${v.name} ${v.code} ${v.serviceName} ${v.categoryName}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [query, variants]);

  const quantity = Math.max(1, Math.floor(Number(qty) || 0));
  const lineAmount = selected ? previewItemAmount(selected.price, quantity) : 0;
  const previewNet = currentNet + lineAmount;
  const previewDue = currentDue + lineAmount;

  const submit = async () => {
    if (!selected) {
      setError('Select a catalog service.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const key = reuseOrCreateBillItemKey(idempotencyKey, opdBillId);
      setIdempotencyKey(key);
      await opdBillingApi.addBillItem(buildAddBillItemRequest({
        opdBillId,
        serviceVariantId: selected.id,
        quantity,
        idempotencyKey: key,
      }));
      setIdempotencyKey('');
      onOpenChange(false);
      onAdded();
    } catch (err: unknown) {
      setError(axiosMessage(err) || 'Could not add this item. Nothing was charged from this screen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" data-testid={T.dialog}>
        <DialogHeader>
          <DialogTitle>Add item — {billNumber}</DialogTitle>
          <DialogDescription>
            Posts a Manual extra on the OpdBill ledger. Catalog price is applied on the server.
            This is an estimate until the bill reloads.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ip-billing-add-item-search" required>Service / item</Label>
            <Input
              id="ip-billing-add-item-search"
              data-testid={T.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search catalog name or code"
              autoComplete="off"
            />
          </div>
          {catalogLoading ? (
            <p className="text-sm text-muted-foreground">Loading catalog…</p>
          ) : catalogError ? (
            <p className="text-sm text-red-700">{catalogError}</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matching catalog items.</li>
              ) : filtered.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    data-testid={T.option}
                    className={`w-full text-left px-3 py-2 text-sm ${selected?.id === v.id ? 'bg-blue-50' : 'hover:bg-muted/60'}`}
                    onClick={() => setSelected(v)}
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground"> · {v.serviceName} · {formatInr(v.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected ? (
            <p className="text-sm">
              Selected: <span className="font-medium">{selected.name}</span>
              {' '}({selected.code}) · catalog rate {formatInr(selected.price)}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ip-billing-add-item-qty" required>Qty</Label>
              <Input
                id="ip-billing-add-item-qty"
                data-testid={T.qty}
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div>
              <Label>Rate (catalog)</Label>
              <p className="text-sm font-medium tabular-nums pt-2">{selected ? formatInr(selected.price) : '—'}</p>
            </div>
            <div>
              <Label>Amount (estimate)</Label>
              <p className="text-sm font-medium tabular-nums pt-2">{selected ? formatInr(lineAmount) : '—'}</p>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between" data-testid={T.previewNet}>
              <span>Estimated new net</span>
              <span className="tabular-nums font-medium">{formatInr(previewNet)}</span>
            </div>
            <div className="flex justify-between" data-testid={T.previewDue}>
              <span>Estimated patient due after</span>
              <span className="tabular-nums font-medium">{formatInr(previewDue)}</span>
            </div>
          </div>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" data-testid={T.submit} onClick={() => { void submit(); }} disabled={busy || !selected}>
            {busy ? 'Adding…' : 'Add item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
