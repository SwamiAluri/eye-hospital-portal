'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchContext } from '@/hooks/use-branch-context';
import {
  getLmsSpecimen,
  listLmsSpecimenRejectionReasons,
  newLmsIdempotencyKey,
  parseLmsSpecimenApiError,
  rejectLmsSpecimen,
  type LmsSpecimenDetailDto,
  type LmsSpecimenRejectionReasonDto,
} from '@/lib/lms/lms-specimens.api';

type Props = {
  specimenId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (detail: LmsSpecimenDetailDto) => void;
};

function formatDob(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function RejectSpecimenDialog({ specimenId, open, onOpenChange, onSuccess }: Props) {
  const { branchId: contextBranchId } = useBranchContext();
  const [detail, setDetail] = useState<LmsSpecimenDetailDto | null>(null);
  const [reasons, setReasons] = useState<LmsSpecimenRejectionReasonDto[]>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, r] = await Promise.all([
        getLmsSpecimen(specimenId),
        listLmsSpecimenRejectionReasons(),
      ]);
      setDetail(d);
      setReasons(r);
      setReasonCode('');
      setConfirmed(false);
    } catch (e) {
      setError(parseLmsSpecimenApiError(e, 'Failed to load rejection context.').message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [specimenId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function submit() {
    if (!detail || !reasonCode) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await rejectLmsSpecimen(detail.id, {
        expectedRowVersion: detail.rowVersion,
        operatingBranchId: contextBranchId || detail.collectionBranchId,
        rejectionReasonCode: reasonCode,
        patientIdentityConfirmed: confirmed,
        confirmedMrn: detail.patientMrnSnapshot ?? '',
        confirmedPatientName: detail.patientNameSnapshot ?? '',
        confirmedDateOfBirth: formatDob(detail.patientDateOfBirthSnapshot),
        idempotencyKey: newLmsIdempotencyKey(),
      });
      toast.success('Specimen rejected');
      onSuccess(result);
    } catch (e) {
      const err = parseLmsSpecimenApiError(e, 'Reject failed.');
      setError(err.message);
      if (err.isConcurrencyConflict) {
        toast.error('Specimen changed. Reloading…');
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="reject-specimen-dialog">
        <DialogHeader>
          <DialogTitle>Reject specimen</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error && !detail ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : detail ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">MRN</dt>
              <dd>{detail.patientMrnSnapshot ?? '—'}</dd>
              <dt className="text-muted-foreground">Patient</dt>
              <dd>{detail.patientNameSnapshot ?? '—'}</dd>
              <dt className="text-muted-foreground">Order</dt>
              <dd>{detail.orderNumber}</dd>
              <dt className="text-muted-foreground">Specimen</dt>
              <dd className="font-mono text-xs">{detail.id}</dd>
            </dl>

            <div className="space-y-1">
              <Label>Rejection reason</Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger data-testid="reject-reason-select">
                  <SelectValue placeholder="Select governed reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.code} value={r.code} data-testid={`reject-reason-${r.code}`}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-start gap-2">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                data-testid="reject-identity-checkbox"
              />
              <span>I confirm patient identity before rejecting this specimen.</span>
            </label>

            {error ? (
              <p className="text-sm text-destructive" data-testid="reject-error">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!detail || !reasonCode || !confirmed || submitting}
            onClick={() => void submit()}
            data-testid="reject-submit"
          >
            {submitting ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
