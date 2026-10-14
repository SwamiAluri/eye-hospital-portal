'use client';

import { useState } from 'react';
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
  newLmsIdempotencyKey,
  parseLmsSpecimenApiError,
  reprintLmsSpecimenLabel,
  type LmsSpecimenLabelPayloadDto,
} from '@/lib/lms/lms-specimens.api';
import {
  SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE,
  abandonSpecimenLabelPrintWindow,
  openSpecimenLabelPrintWindow,
} from '@/lib/lms/specimen-label-print';

type Props = {
  specimenId: string;
  rowVersion: number;
  operatingBranchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (label: LmsSpecimenLabelPayloadDto, printWindow: Window) => void;
};

export function ReprintSpecimenLabelDialog({
  specimenId,
  rowVersion,
  operatingBranchId,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reprint reason is required.');
      return;
    }
    // Open while still in the user-gesture stack — before any await.
    const printWindow = openSpecimenLabelPrintWindow();
    if (!printWindow) {
      setError(SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const label = await reprintLmsSpecimenLabel(specimenId, {
        expectedRowVersion: rowVersion,
        operatingBranchId,
        reason: trimmed,
        idempotencyKey: newLmsIdempotencyKey(),
      });
      onSuccess(label, printWindow);
      setReason('');
      onOpenChange(false);
    } catch (e) {
      abandonSpecimenLabelPrintWindow(printWindow);
      const err = parseLmsSpecimenApiError(e, 'Reprint failed.');
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="reprint-label-dialog">
        <DialogHeader>
          <DialogTitle>Reprint specimen label</DialogTitle>
          <DialogDescription>
            Reprints the existing barcode. A reason is required. No new barcode is allocated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reprint-reason">Reason</Label>
          <Textarea
            id="reprint-reason"
            data-testid="reprint-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
            aria-required="true"
          />
          {error ? (
            <p className="text-sm text-destructive" data-testid="reprint-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="reprint-confirm"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? 'Reprinting…' : 'Reprint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
