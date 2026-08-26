'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RefundMode } from '@/lib/api/refunds.api';
import { REFUND_TEST_IDS, type RefundRecord } from '@/lib/billing/refund-contract';
import { formatInr } from '@/lib/billing/group-bill-items';

export type RefundActionKind = 'approve' | 'reject' | 'complete';

export function WorkstationRefundActionDialog({
  action,
  notes,
  refundMode,
  modeChoices,
  submitting,
  onNotesChange,
  onModeChange,
  onClose,
  onConfirm,
}: {
  action: { kind: RefundActionKind; refund: RefundRecord } | null;
  notes: string;
  refundMode: RefundMode;
  modeChoices: Array<{ masterCode: string; apiMode: string; label: string }>;
  submitting: boolean;
  onNotesChange: (value: string) => void;
  onModeChange: (value: RefundMode) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const kind = action?.kind;
  const title =
    kind === 'approve'
      ? 'Authorize refund'
      : kind === 'reject'
        ? 'Reject refund'
        : 'Complete refund payout';
  const confirmLabel =
    kind === 'approve' ? 'Authorize' : kind === 'reject' ? 'Reject' : 'Complete payout';
  const rejectBlocked = kind === 'reject' && notes.trim().length < 3;
  const completeBlocked = kind === 'complete' && !refundMode;

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]" data-testid={REFUND_TEST_IDS.actionDialog}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {action ? (
              <span>
                {formatInr(action.refund.refundAmount)} on this bill
                {action.refund.refundReason ? ` · ${action.refund.refundReason}` : ''}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {kind === 'complete' ? (
            <div className="space-y-2">
              <Label htmlFor="refund-complete-mode">Payout mode</Label>
              <Select value={refundMode} onValueChange={(v) => onModeChange(v as RefundMode)}>
                <SelectTrigger id="refund-complete-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modeChoices.map((choice) => (
                    <SelectItem key={choice.masterCode} value={choice.apiMode}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Completing posts a Refund ledger line and reprojects AmountPaid. Money does not move on authorize.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {kind === 'approve'
                ? 'Authorization does not post cash. Complete payout after approval to write the Refund ledger line.'
                : 'Rejection does not unwind a completed payout on this bill.'}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="refund-action-notes">
              {kind === 'reject' ? 'Rejection reason' : 'Notes (optional)'}
            </Label>
            <Textarea
              id="refund-action-notes"
              data-testid={REFUND_TEST_IDS.actionNotes}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            data-testid={REFUND_TEST_IDS.actionSubmit}
            onClick={onConfirm}
            disabled={submitting || rejectBlocked || completeBlocked}
            variant={kind === 'reject' ? 'destructive' : 'default'}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
