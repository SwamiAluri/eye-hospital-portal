'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBranchContext } from '@/hooks/use-branch-context';
import {
  getLmsSpecimen,
  newLmsIdempotencyKey,
  parseLmsSpecimenApiError,
  receiveLmsSpecimen,
  type LmsSpecimenDetailDto,
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

export function ReceiveSpecimenDialog({ specimenId, open, onOpenChange, onSuccess }: Props) {
  const { branches, branchId: contextBranchId } = useBranchContext();
  const [detail, setDetail] = useState<LmsSpecimenDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [location, setLocation] = useState('');
  const [branchId, setBranchId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getLmsSpecimen(specimenId);
      setDetail(d);
      setBranchId(contextBranchId || d.collectionBranchId);
      setConfirmed(false);
      setLocation('');
    } catch (e) {
      setError(parseLmsSpecimenApiError(e, 'Failed to load specimen.').message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [specimenId, contextBranchId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function submit() {
    if (!detail) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await receiveLmsSpecimen(detail.id, {
        expectedRowVersion: detail.rowVersion,
        receivingBranchId: branchId,
        patientIdentityConfirmed: confirmed,
        confirmedMrn: detail.patientMrnSnapshot ?? '',
        confirmedPatientName: detail.patientNameSnapshot ?? '',
        confirmedDateOfBirth: formatDob(detail.patientDateOfBirthSnapshot),
        receivingLocationText: location.trim() || null,
        idempotencyKey: newLmsIdempotencyKey(),
      });
      toast.success(`Received · ${result.accession}`);
      onSuccess(result);
    } catch (e) {
      const err = parseLmsSpecimenApiError(e, 'Receive failed.');
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
      <DialogContent className="max-w-lg" data-testid="receive-specimen-dialog">
        <DialogHeader>
          <DialogTitle>Receive specimen</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error && !detail ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : detail ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">MRN</dt>
              <dd data-testid="receive-confirm-mrn">{detail.patientMrnSnapshot ?? '—'}</dd>
              <dt className="text-muted-foreground">Patient</dt>
              <dd data-testid="receive-confirm-name">{detail.patientNameSnapshot ?? '—'}</dd>
              <dt className="text-muted-foreground">DOB</dt>
              <dd data-testid="receive-confirm-dob">
                {detail.patientDateOfBirthSnapshot
                  ? new Date(detail.patientDateOfBirthSnapshot).toLocaleDateString()
                  : '—'}
              </dd>
              <dt className="text-muted-foreground">Order</dt>
              <dd>{detail.orderNumber}</dd>
              <dt className="text-muted-foreground">Specimen</dt>
              <dd className="font-mono text-xs">{detail.id}</dd>
            </dl>

            <div className="space-y-1">
              <Label htmlFor="receive-branch">Receiving branch</Label>
              <select
                id="receive-branch"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                data-testid="receive-branch"
              >
                {branches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="receive-location">Receiving location (optional)</Label>
              <Input
                id="receive-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                data-testid="receive-location"
              />
            </div>

            <label className="flex items-start gap-2" data-testid="receive-identity-confirm">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                data-testid="receive-identity-checkbox"
              />
              <span>
                I confirm the patient MRN, name, and date of birth match the specimen presented.
              </span>
            </label>

            {error ? (
              <p className="text-sm text-destructive" data-testid="receive-error">
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
            disabled={!detail || !confirmed || !branchId || submitting}
            onClick={() => void submit()}
            data-testid="receive-submit"
          >
            {submitting ? 'Receiving…' : 'Receive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
