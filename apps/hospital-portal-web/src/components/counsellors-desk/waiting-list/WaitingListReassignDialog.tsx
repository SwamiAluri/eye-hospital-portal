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
  CounsellingSearchInput,
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
  counselorOptionLabel,
  filterCounselorsByQuery,
  formatEligibleCounsellorCount,
  resolveAssignCounsellorListState,
} from '@/lib/counsellors-desk/ownership-display-name';
import { cn } from '@/lib/utils';

export type WaitingListReassignDialogProps = {
  open: boolean;
  sessionId: string | null;
  patientName?: string;
  currentOwnerId: string | null;
  currentOwnerName?: string | null;
  sessionBranchId?: string | null;
  onOpenChange: (open: boolean) => void;
  onReassigned: (result: {
    sessionId: string;
    counselorId: string;
    counselorName: string | null;
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
  onOpenChange,
  onReassigned,
  onOwnershipConflict,
}: WaitingListReassignDialogProps) {
  const [counselors, setCounselors] = useState<CounselingCounselorOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCounselors = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await counsellorsDeskApi.getCounselors(sessionBranchId);
      const peers = currentOwnerId
        ? list.filter((c) => c.id !== currentOwnerId)
        : list;
      setCounselors(peers);
      setSelectedId(peers[0]?.id ?? '');
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
      setSearchQuery('');
      setReason('');
      setReasonError(null);
      void loadCounselors();
    } else {
      setSelectedId('');
      setListError(null);
      setSubmitting(false);
      setSearchQuery('');
      setReason('');
      setReasonError(null);
    }
  }, [open, loadCounselors]);

  const filteredCounselors = useMemo(
    () => filterCounselorsByQuery(counselors, searchQuery),
    [counselors, searchQuery],
  );

  const listState = resolveAssignCounsellorListState({
    loading: loadingList,
    error: listError,
    eligibleCount: counselors.length,
    filteredCount: filteredCounselors.length,
    query: searchQuery,
  });

  useEffect(() => {
    if (listState !== 'ready') {
      if (listState === 'no-match' || listState === 'empty') setSelectedId('');
      return;
    }
    if (!filteredCounselors.some((c) => c.id === selectedId)) {
      setSelectedId(filteredCounselors[0]?.id ?? '');
    }
  }, [listState, filteredCounselors, selectedId]);

  const selected = useMemo(
    () => filteredCounselors.find((c) => c.id === selectedId) ?? null,
    [filteredCounselors, selectedId],
  );

  const handleReassign = async () => {
    if (!sessionId || !selectedId || !currentOwnerId || submitting) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Reason is required.');
      return;
    }
    setReasonError(null);
    setSubmitting(true);
    try {
      const result = await counsellorsDeskApi.reassignSession(sessionId, {
        counselorId: selectedId,
        expectedCounselorId: currentOwnerId,
        reason: trimmed,
      });
      toast.success('Session reassigned');
      onReassigned({
        sessionId,
        counselorId: result.counselorId,
        counselorName: result.counselorName,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 409) {
        toast.error('Session ownership changed. Refreshing…');
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
  const canSubmit =
    Boolean(sessionId && selected && currentOwnerId && reason.trim()) && !submitting;

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
            <CounsellingLabel htmlFor="reassign-counsellor-search">
              New owner
            </CounsellingLabel>
            <CounsellingSearchInput
              id="reassign-counsellor-search"
              className="mt-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search counsellors"
              disabled={loadingList || !!listError}
              data-testid="waiting-list-reassign-search"
            />
            {listState === 'loading' ? (
              <CounsellingStatusMessage className="mt-2" tone="muted">
                Loading counsellors…
              </CounsellingStatusMessage>
            ) : null}
            {listState === 'error' ? (
              <div className="mt-2 space-y-2">
                <CounsellingStatusMessage tone="error">{listError}</CounsellingStatusMessage>
                <CounsellingButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadCounselors()}
                >
                  Retry
                </CounsellingButton>
              </div>
            ) : null}
            {listState === 'empty' ? (
              <CounsellingStatusMessage className="mt-2" tone="muted">
                No eligible counsellors available
              </CounsellingStatusMessage>
            ) : null}
            {listState === 'no-match' ? (
              <CounsellingStatusMessage className="mt-2" tone="muted">
                No counsellors match your search
              </CounsellingStatusMessage>
            ) : null}
            {listState === 'ready' ? (
              <>
                <p className="mt-1 text-xs text-counselling-muted-foreground">
                  {formatEligibleCounsellorCount(counselors.length)}
                </p>
                <CounsellingSelect value={selectedId} onValueChange={setSelectedId}>
                  <CounsellingSelectTrigger
                    className="mt-1"
                    data-testid="waiting-list-reassign-select"
                  >
                    <CounsellingSelectValue placeholder="Select counsellor" />
                  </CounsellingSelectTrigger>
                  <CounsellingSelectContent>
                    {filteredCounselors.map((c) => (
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
            <textarea
              id="reassign-reason"
              className={cn(
                'mt-1 min-h-[72px] w-full rounded-md border border-counselling-border bg-background px-3 py-2 text-sm',
                'text-counselling-foreground placeholder:text-counselling-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
                reasonError && 'border-destructive',
              )}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder="Why is this session being reassigned?"
              maxLength={500}
              disabled={submitting}
              data-testid="waiting-list-reassign-reason"
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? 'reassign-reason-error' : undefined}
            />
            {reasonError ? (
              <p
                id="reassign-reason-error"
                className="mt-1 text-xs text-destructive"
                role="alert"
              >
                {reasonError}
              </p>
            ) : null}
          </div>
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
            disabled={!canSubmit || listState !== 'ready'}
            data-testid="waiting-list-reassign-submit"
          >
            {submitting ? 'Reassigning…' : 'Reassign'}
          </CounsellingButton>
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
