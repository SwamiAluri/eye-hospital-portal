'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  assignLmsCollectionTask,
  claimLmsCollectionTask,
  getLmsCollectionTask,
  newLmsIdempotencyKey,
  parseLmsCollectionApiError,
  releaseLmsCollectionTask,
  transitionLmsCollectionTask,
  type LmsCollectionTaskDetailDto,
} from '@/lib/lms/lms-collection.api';
import {
  completeLmsCollection,
  getLmsSpecimenByCollectionTask,
  parseLmsSpecimenApiError,
  type LmsSpecimenDetailDto,
} from '@/lib/lms/lms-specimens.api';
import { useBranchContext } from '@/hooks/use-branch-context';
import { CollectionStatusBadge } from './CollectionStatusBadge';

type Props = {
  taskId: string | null;
  open: boolean;
  canManage: boolean;
  canCollect: boolean;
  canCompleteCollection: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

const NEXT: Record<string, string | null> = {
  Planned: 'Ready',
  Ready: 'InProgress',
  InProgress: 'Completed',
  Completed: null,
  Cancelled: null,
};

/** Client-side GUID shape check only — server still validates (assignee_invalid). */
const ASSIGN_USER_GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function formatDob(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function CollectionTaskDetailSheet({
  taskId,
  open,
  canManage,
  canCollect,
  canCompleteCollection,
  onOpenChange,
  onChanged,
}: Props) {
  const router = useRouter();
  const { branches } = useBranchContext();
  const [detail, setDetail] = useState<LmsCollectionTaskDetailDto | null>(null);
  const [specimen, setSpecimen] = useState<LmsSpecimenDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      // Opening/viewing MUST NOT claim (PD-COL-16).
      const d = await getLmsCollectionTask(taskId);
      setDetail(d);
      if (d.status === 'Completed') {
        try {
          setSpecimen(await getLmsSpecimenByCollectionTask(taskId));
        } catch {
          setSpecimen(null);
        }
      } else {
        setSpecimen(null);
      }
    } catch (e) {
      setError(parseLmsCollectionApiError(e, 'Failed to load collection task.').message);
      setDetail(null);
      setSpecimen(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      setCancelReason('');
      setAssignUserId('');
      setConfirmOpen(false);
      setIdentityConfirmed(false);
      void load();
    }
  }, [open, taskId, load]);

  const run = async (action: () => Promise<LmsCollectionTaskDetailDto>, ok: string) => {
    setBusy(true);
    try {
      const d = await action();
      setDetail(d);
      toast.success(ok);
      onChanged();
    } catch (e) {
      const err = parseLmsCollectionApiError(e, 'Action failed.');
      toast.error(err.message);
      if (err.isConcurrencyConflict) void load();
    } finally {
      setBusy(false);
    }
  };

  const runCompleteCollection = async () => {
    if (!detail || !identityConfirmed) return;
    setBusy(true);
    try {
      const result = await completeLmsCollection(
        detail.id,
        detail.rowVersion,
        true,
        newLmsIdempotencyKey(),
      );
      setSpecimen(result);
      setConfirmOpen(false);
      toast.success('Collection completed — Specimen created');
      onChanged();
      onOpenChange(false);
      router.push(`/dashboard/lms/specimens/${result.id}`);
    } catch (e) {
      const err = parseLmsSpecimenApiError(e, 'Complete Collection failed.');
      toast.error(err.message);
      if (err.isConcurrencyConflict || err.isAlreadyExists) void load();
    } finally {
      setBusy(false);
    }
  };

  const next = detail ? NEXT[detail.status] : null;
  const terminal = detail?.status === 'Completed' || detail?.status === 'Cancelled';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" data-testid="collection-task-detail">
        <SheetHeader>
          <SheetTitle>Collection task</SheetTitle>
        </SheetHeader>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : detail ? (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold" data-testid="collection-task-number">
                {detail.taskNumber}
              </span>
              <CollectionStatusBadge status={detail.status} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Order</dt>
              <dd>{detail.orderNumber}</dd>
              <dt className="text-muted-foreground">Patient</dt>
              <dd>
                {detail.patientNameSnapshot ?? '—'}
                {detail.patientMrnSnapshot ? ` · MRN ${detail.patientMrnSnapshot}` : ''}
              </dd>
              <dt className="text-muted-foreground">DOB</dt>
              <dd data-testid="collection-task-dob">
                {formatDob(detail.patientDateOfBirthSnapshot)}
              </dd>
              <dt className="text-muted-foreground">Branch</dt>
              <dd data-testid="collection-task-branch">
                {branches.find((b) => b.branchId === detail.collectionBranchId)?.branchName ??
                  detail.collectionBranchId}
              </dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd>{detail.locationText ?? '—'}</dd>
              {/* PD-COL-OWN-01 — Assigned (planned) and Claimed (active) shown independently */}
              <dt className="text-muted-foreground">Assigned</dt>
              <dd data-testid="collection-task-assigned">
                {detail.assignedToUserId ? detail.assignedToUserId.slice(0, 8) + '…' : '—'}
              </dd>
              <dt className="text-muted-foreground">Claimed</dt>
              <dd data-testid="collection-task-claimed">
                {detail.claimedByUserId ? detail.claimedByUserId.slice(0, 8) + '…' : 'Unclaimed'}
              </dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
            </dl>

            <div>
              <div className="mb-1 font-medium">OrderTests on this task</div>
              <ul className="space-y-1 rounded border p-2" data-testid="collection-task-tests">
                {detail.orderTests.map((t) => (
                  <li key={t.id}>
                    {t.displayNameSnapshot ?? t.orderTestId}
                    {t.internalOrderCodeSnapshot ? (
                      <span className="text-muted-foreground"> ({t.internalOrderCodeSnapshot})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            {detail.status === 'Completed' ? (
              <div className="space-y-2 rounded border p-3" data-testid="complete-collection-panel">
                {specimen ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Specimen created (state Collected). Collection task remains Completed.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="view-specimen"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/dashboard/lms/specimens/${specimen.id}`);
                      }}
                    >
                      View Specimen
                    </Button>
                  </>
                ) : canCompleteCollection ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Completed does not create a Specimen. Use Complete Collection to create one.
                    </p>
                    {!confirmOpen ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        data-testid="complete-collection-open"
                        onClick={() => {
                          setIdentityConfirmed(false);
                          setConfirmOpen(true);
                        }}
                      >
                        Complete Collection
                      </Button>
                    ) : (
                      <div className="space-y-3" data-testid="complete-collection-confirm">
                        <p className="font-medium">Confirm patient identity</p>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                          <dt className="text-muted-foreground">MRN</dt>
                          <dd data-testid="confirm-mrn">{detail.patientMrnSnapshot ?? '—'}</dd>
                          <dt className="text-muted-foreground">Name</dt>
                          <dd data-testid="confirm-name">{detail.patientNameSnapshot ?? '—'}</dd>
                          <dt className="text-muted-foreground">DOB</dt>
                          <dd data-testid="confirm-dob">
                            {formatDob(detail.patientDateOfBirthSnapshot)}
                          </dd>
                        </dl>
                        <label className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={identityConfirmed}
                            data-testid="confirm-identity-checkbox"
                            onChange={(e) => setIdentityConfirmed(e.target.checked)}
                          />
                          <span>
                            I confirm this patient identity and that collection was completed
                            successfully.
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || !identityConfirmed}
                            data-testid="complete-collection-submit"
                            onClick={() => void runCompleteCollection()}
                          >
                            Confirm Complete Collection
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setConfirmOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Complete Collection requires `lms.specimens.manage` and `lms.collection.collect`.
                    Accession, barcode, and Receiving are not available here.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded border border-dashed p-2 text-xs text-muted-foreground">
                Specimen creation requires a Completed task and explicit Complete Collection.
                Accession, barcode, label, and receiving are not part of this slice.
              </p>
            )}

            {!terminal ? (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {next && (canManage || canCollect) ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    data-testid="collection-task-transition"
                    onClick={() =>
                      void run(
                        () =>
                          transitionLmsCollectionTask(
                            detail.id,
                            detail.rowVersion,
                            next,
                            null,
                            newLmsIdempotencyKey(),
                          ),
                        `Moved to ${next}`,
                      )
                    }
                  >
                    Mark {next}
                  </Button>
                ) : null}
                {canCollect && !detail.claimedByUserId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    data-testid="collection-task-claim"
                    onClick={() =>
                      void run(
                        () =>
                          claimLmsCollectionTask(
                            detail.id,
                            detail.rowVersion,
                            newLmsIdempotencyKey(),
                          ),
                        'Task claimed',
                      )
                    }
                  >
                    Claim
                  </Button>
                ) : null}
                {canCollect && detail.claimedByUserId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    data-testid="collection-task-release"
                    onClick={() =>
                      void run(
                        () =>
                          releaseLmsCollectionTask(
                            detail.id,
                            detail.rowVersion,
                            newLmsIdempotencyKey(),
                          ),
                        'Claim released',
                      )
                    }
                  >
                    Release claim
                  </Button>
                ) : null}
              </div>
            ) : null}

            {canManage && !terminal ? (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="col-assign">Assign to user ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="col-assign"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    placeholder="User GUID"
                    data-testid="collection-task-assign-input"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !assignUserId.trim()}
                    data-testid="collection-task-assign"
                    onClick={() => {
                      const raw = assignUserId.trim();
                      if (!ASSIGN_USER_GUID_RE.test(raw)) {
                        toast.error('Assignee user ID must be a valid GUID.');
                        return;
                      }
                      void run(
                        () =>
                          assignLmsCollectionTask(
                            detail.id,
                            detail.rowVersion,
                            raw,
                            newLmsIdempotencyKey(),
                          ),
                        'Task assigned',
                      );
                    }}
                  >
                    Assign
                  </Button>
                </div>
                <Label htmlFor="col-cancel">Cancel reason</Label>
                <div className="flex gap-2">
                  <Input
                    id="col-cancel"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    data-testid="collection-task-cancel-reason"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy || !cancelReason.trim()}
                    data-testid="collection-task-cancel"
                    onClick={() =>
                      void run(
                        () =>
                          transitionLmsCollectionTask(
                            detail.id,
                            detail.rowVersion,
                            'Cancelled',
                            cancelReason.trim(),
                            newLmsIdempotencyKey(),
                          ),
                        'Task cancelled',
                      )
                    }
                  >
                    Cancel task
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
