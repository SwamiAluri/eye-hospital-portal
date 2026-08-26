'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { formatInr } from '@/lib/billing/group-bill-items';
import { opdBillingApi } from '@/lib/api/opd-billing.api';
import { axiosMessage } from '@/lib/ip-management/collect-payment';
import {
  DISCOUNT_TEST_IDS as T,
  buildApplyDiscountRequest,
  previewDiscountAmount,
  reuseOrCreateDiscountKey,
} from '@/lib/billing/workstation-mutations';

export function ApplyDiscountDialog({
  open,
  onOpenChange,
  opdBillId,
  billNumber,
  grossAmount,
  netAmount,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opdBillId: string;
  billNumber: string;
  grossAmount: number;
  netAmount: number;
  onApplied: () => void;
}) {
  const [percent, setPercent] = useState('10');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef('');

  useEffect(() => {
    if (!open) return;
    setPercent('10');
    setReason('');
    setError(null);
    setBusy(false);
    keyRef.current = reuseOrCreateDiscountKey('', opdBillId);
  }, [open, opdBillId]);

  const pct = Number(percent);
  const discountPreview = previewDiscountAmount(grossAmount, Number.isFinite(pct) ? pct : 0);
  const netAfter = Math.max(0, netAmount - discountPreview);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      keyRef.current = reuseOrCreateDiscountKey(keyRef.current, opdBillId);
      await opdBillingApi.applyDiscount(buildApplyDiscountRequest({
        opdBillId,
        discountPercentage: pct,
        discountReason: reason,
        idempotencyKey: keyRef.current,
      }));
      onOpenChange(false);
      onApplied();
    } catch (err: unknown) {
      setError(axiosMessage(err) || 'Could not apply the discount.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={T.dialog}>
        <DialogHeader>
          <DialogTitle>Apply discount — {billNumber}</DialogTitle>
          <DialogDescription>
            Applies this percent of current gross as a Discount ledger line. Approval PIN is not
            enforced by the server. Reason is required and audited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <p className="text-sm pt-2">Percentage of gross</p>
            </div>
            <div>
              <Label htmlFor="ip-billing-discount-percent" required>Value (%)</Label>
              <Input
                id="ip-billing-discount-percent"
                data-testid={T.percent}
                type="number"
                min={0.01}
                max={100}
                step={0.01}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ip-billing-discount-reason" required>Reason</Label>
            <Textarea
              id="ip-billing-discount-reason"
              data-testid={T.reason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why this concession is being applied"
            />
          </div>
          <div className="rounded-md border bg-amber-50/80 p-3 text-sm space-y-1" data-testid={T.preview}>
            <p>Estimated discount: <span className="tabular-nums font-medium">{formatInr(discountPreview)}</span></p>
            <p>Estimated net after: <span className="tabular-nums font-medium">{formatInr(netAfter)}</span></p>
            <p className="text-muted-foreground">Server totals replace this estimate after apply.</p>
          </div>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid={T.submit}
            onClick={() => { void submit(); }}
            disabled={busy || !reason.trim() || !(pct > 0) || pct > 100}
          >
            {busy ? 'Applying…' : 'Apply discount'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
