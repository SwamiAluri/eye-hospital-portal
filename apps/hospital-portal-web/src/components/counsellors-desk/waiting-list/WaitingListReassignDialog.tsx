'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  CounsellingButton,
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogDescription,
  CounsellingDialogFooter,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingLabel,
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectItem,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
  CounsellingStatusMessage,
} from '@/components/counsellors-desk/session/primitives';
import { counsellorsDeskApi, type CounselingCounselorOption } from '@/lib/api/counsellors-desk.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';
import {
  counselorOptionLabel,
  formatEligibleCounsellorCount,
  resolveAssignCounsellorListState,
} from '@/lib/counsellors-desk/ownership-display-name';
import {
  REASSIGN_OTHER_REASON,
  REASSIGN_REASON_OPTIONS,
  canSubmitReassignForm,
  excludeCurrentOwnerFromTargets,
  resolveReassignReasonPayload,
} from '@/lib/counsellors-desk/reassign-dialog-form';
import { cn } from '@/lib/utils';

export type WaitingListReassignDialogProps = {
  open: boolean;
  sessionId: string | null;
  patientName?: string;
  currentOwnerId: string | null;
  currentOwnerName?: string | null;
  sessionBranchId?: string | null;
  /**
   * Optimistic concurrency token for CounselingSession.Version (Phase 3I Slice 7 / PD-S7-01).
   * `undefined` until the waiting-list API projection exposes it — see WaitingListPatient.version.
   */
  sessionVersion?: number;
  onOpenChange: (open: boolean) => void;
  onReassigned: (result: {
    sessionId: string;
    counselorId: string;
    counselorName: string | null;
    version?: number;
  }) => void;
  /** Called on 409 so the page can refresh ownership. */
  onOwnershipConflict?: () => void;
};

export function WaitingListReassignDialog({
  open,
  sessionId,
  patientName,
  currentOwnerId,
  currentOwnerName,
  sessionBranchId,
  sessionVersion,
  onOpenChange,
  onReassigned,
  onOwnershipConflict,
}: WaitingListReassignDialogProps) {
  const [counselors, setCounselors] = useState<CounselingCounselorOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [reasonChoice, setReasonChoice] = useState('');
  const [additionalReason, setAdditionalReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCounselors = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await counsellorsDeskApi.getCounselors(sessionBranchId);
      const peers = excludeCurrentOwnerFromTargets(list, currentOwnerId);
      setCounselors(peers);
      // Explicit selection required — do not auto-pick first peer.
      setSelectedId('');
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not load counsellors.'));
      setCounselors([]);
      setSelectedId('');
    } finally {
      setLoadingList(false);
    }
  }, [sessionBranchId, currentOwnerId]);

  useEffect(() => {
    if (open) {
      setSelectedId('');
      setReasonChoice('');
      setAdditionalReason('');
      setReasonError(null);
      void loadCounselors();
    } else {
      setSelectedId('');
      setListError(null);
      setSubmitting(false);
      setReasonChoice('');
      setAdditionalReason('');
      setReasonError(null);
    }
  }, [open, loadCounselors]);

  const listState = resolveAssignCounsellorListState({
    loading: loadingList,
    error: listError,
    eligibleCount: counselors.length,
    filteredCount: counselors.length,
    query: '',
  });

  const selected = useMemo(
    () => counselors.find((c) => c.id === selectedId) ?? null,
    [counselors, selectedId],
  );

  const isOtherReason = reasonChoice === REASSIGN_OTHER_REASON;

  const canSubmit =
    Boolean(sessionId && currentOwnerId && selected) &&
    canSubmitReassignForm({
      selectedCounselorId: selectedId,
      reasonChoice,
      additionalReason,
      submitting,
    });

  const handleReassign = async () => {
    if (!sessionId || !selectedId || !currentOwnerId || submitting) return;
    const resolved = resolveReassignReasonPayload({
      reasonChoice,
      additionalReason,
    });
    if (!resolved.ok) {
      setReasonError(
        isOtherReason
          ? 'Additional reason is required.'
          : 'Reason is required.',
      );
      return;
    }
    setReasonError(null);
    setSubmitting(true);
    try {
      const result = await counsellorsDeskApi.reassignSession(sessionId, {
        counselorId: selectedId,
        expectedCounselorId: currentOwnerId,
        reason: resolved.reason,
        version: sessionVersion,
      });
      toast.success('Session reassigned');
      onReassigned({
        sessionId,
        counselorId: result.counselorId,
        counselorName: result.counselorName,
        version: result.version,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      // Phase 3I Slice 7 (PD-S7-06): stale-ownership vs stale-Version share the 409 status;
      // surface the server's message verbatim (falls back to the standard stale-session copy).
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
        onOwnershipConflict?.();
        onOpenChange(false);
      } else {
        toast.error(getApiErrorMessage(err, 'Failed to reassign session.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ownerLabel = currentOwnerName?.trim() || 'Current owner';

  return (
    <CounsellingDialog open={open} onOpenChange={onOpenChange}>
      <CounsellingDialogContent
        className="sm:max-w-md"
        data-testid="waiting-list-reassign-dialog"
      >
        <CounsellingDialogHeader>
          <CounsellingDialogTitle>Reassign session</CounsellingDialogTitle>
          <CounsellingDialogDescription>
            {patientName
              ? `Transfer ownership for ${patientName}.`
              : 'Transfer counselling ownership to another counsellor.'}
          </CounsellingDialogDescription>
        </CounsellingDialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <CounsellingLabel>Current owner</CounsellingLabel>
            <p
              className="mt-1 text-sm font-medium text-counselling-foreground"
              data-testid="waiting-list-reassign-current-owner"
            >
              {ownerLabel}
            </p>
          </div>

          <div>
            <CounsellingLabel htmlFor="reassign-new-owner">
              New owner
            </CounsellingLabel>
            {listState === 'loading' ? (
              <CounsellingStatusMessage
                className="mt-2"
                tone="loading"
                title="Loading counsellors…"
              />
            ) : null}
            {listState === 'error' ? (
              <CounsellingStatusMessage
                className="mt-2"
                tone="error"
                title={listError ?? 'Could not load counsellors.'}
                action={
                  <CounsellingButton
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void loadCounselors()}
                  >
                    Retry
                  </CounsellingButton>
                }
              />
            ) : null}
            {listState === 'empty' ? (
              <CounsellingStatusMessage
                className="mt-2"
                tone="info"
                title="No eligible counsellors available"
              />
            ) : null}
            {listState === 'ready' ? (
              <>
                <p className="mt-1 text-xs text-counselling-muted-foreground">
                  {formatEligibleCounsellorCount(counselors.length)}
                </p>
                <CounsellingSelect
                  value={selectedId || undefined}
                  onValueChange={setSelectedId}
                >
                  <CounsellingSelectTrigger
                    id="reassign-new-owner"
                    className="mt-1"
                    aria-label="New owner"
                    data-testid="waiting-list-reassign-select"
                  >
                    <CounsellingSelectValue placeholder="Select counsellor" />
                  </CounsellingSelectTrigger>
                  <CounsellingSelectContent>
                    {counselors.map((c) => (
                      <CounsellingSelectItem key={c.id} value={c.id}>
                        {counselorOptionLabel(c)}
                      </CounsellingSelectItem>
                    ))}
                  </CounsellingSelectContent>
                </CounsellingSelect>
              </>
            ) : null}
          </div>

          <div>
            <CounsellingLabel htmlFor="reassign-reason">Reason</CounsellingLabel>
            <CounsellingSelect
              value={reasonChoice || undefined}
              onValueChange={(value) => {
                setReasonChoice(value);
                if (value !== REASSIGN_OTHER_REASON) {
                  setAdditionalReason('');
                }
                if (reasonError) setReasonError(null);
              }}
              disabled={submitting}
            >
              <CounsellingSelectTrigger
                id="reassign-reason"
                className="mt-1"
                aria-label="Reason"
                aria-invalid={Boolean(reasonError)}
                aria-describedby={reasonError ? 'reassign-reason-error' : undefined}
                data-testid="waiting-list-reassign-reason"
              >
                <CounsellingSelectValue placeholder="Select reason" />
              </CounsellingSelectTrigger>
              <CounsellingSelectContent>
                {REASSIGN_REASON_OPTIONS.map((option) => (
                  <CounsellingSelectItem key={option} value={option}>
                    {option}
                  </CounsellingSelectItem>
                ))}
              </CounsellingSelectContent>
            </CounsellingSelect>
            {reasonError && !isOtherReason ? (
              <p
                id="reassign-reason-error"
                className="mt-1 text-xs text-destructive"
                role="alert"
              >
                {reasonError}
              </p>
            ) : null}
          </div>

          {isOtherReason ? (
            <div>
              <CounsellingLabel htmlFor="reassign-additional-reason">
                Additional reason
              </CounsellingLabel>
              <textarea
                id="reassign-additional-reason"
                className={cn(
                  'mt-1 min-h-[72px] w-full rounded-md border border-counselling-border bg-background px-3 py-2 text-sm',
                  'text-counselling-foreground placeholder:text-counselling-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
                  reasonError && 'border-destructive',
                )}
                value={additionalReason}
                onChange={(e) => {
                  setAdditionalReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder="Enter reason…"
                maxLength={500}
                disabled={submitting}
                data-testid="waiting-list-reassign-additional-reason"
                aria-invalid={Boolean(reasonError)}
                aria-describedby={
                  reasonError ? 'reassign-additional-reason-error' : undefined
                }
                aria-required
              />
              {reasonError ? (
                <p
                  id="reassign-additional-reason-error"
                  className="mt-1 text-xs text-destructive"
                  role="alert"
                >
                  {reasonError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <CounsellingDialogFooter>
          <CounsellingButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </CounsellingButton>
          <CounsellingButton
            type="button"
            onClick={() => void handleReassign()}
            disabled={!canSubmit}
            data-testid="waiting-list-reassign-submit"
          >
            {submitting ? 'Reassigning…' : 'Reassign'}
          </CounsellingButton>
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
