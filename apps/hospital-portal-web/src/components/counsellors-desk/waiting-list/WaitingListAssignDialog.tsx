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
import { useAuthStore } from '@/lib/auth-store';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { canShowCounsellingAssignToMe } from '@/lib/counsellors-desk/counselling-auth';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';
import {
  counselorOptionLabel,
  filterCounselorsByQuery,
  formatEligibleCounsellorCount,
  resolveAssignCounsellorListState,
} from '@/lib/counsellors-desk/ownership-display-name';
import { cn } from '@/lib/utils';

export type WaitingListAssignDialogProps = {
  open: boolean;
  sessionId: string | null;
  patientName?: string;
  /** Session branch for same-branch counsellor discovery (UX). */
  sessionBranchId?: string | null;
  /**
   * Optimistic concurrency token for CounselingSession.Version (Phase 3I Slice 7 / PD-S7-01).
   * `undefined` until the waiting-list API projection exposes it — see WaitingListPatient.version.
   */
  sessionVersion?: number;
  onOpenChange: (open: boolean) => void;
  onAssigned: (result: {
    sessionId: string;
    counselorId: string;
    counselorName: string | null;
    version?: number;
  }) => void;
};

export function WaitingListAssignDialog({
  open,
  sessionId,
  patientName,
  sessionBranchId,
  sessionVersion,
  onOpenChange,
  onAssigned,
}: WaitingListAssignDialogProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const roles = useAuthStore((s) => s.roles);
  const userType = useAuthStore((s) => s.user?.userType);
  const showAssignToMe = canShowCounsellingAssignToMe({ roles, userType });

  const [counselors, setCounselors] = useState<CounselingCounselorOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const loadCounselors = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await counsellorsDeskApi.getCounselors(sessionBranchId);
      // Peer dropdown excludes current user when Assign to me is available.
      const peers =
        showAssignToMe && currentUserId
          ? list.filter((c) => c.id !== currentUserId)
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
  }, [sessionBranchId, showAssignToMe, currentUserId]);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      void loadCounselors();
    } else {
      setSelectedId('');
      setListError(null);
      setSubmitting(false);
      setSearchQuery('');
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

  const completeAssign = async (targetId: string, successLabel: string) => {
    if (!sessionId || !targetId || submitting) return;
    setSubmitting(true);
    try {
      const result = await counsellorsDeskApi.assignSession(sessionId, targetId, sessionVersion);
      toast.success(successLabel);
      onAssigned({
        sessionId,
        counselorId: result.counselorId,
        counselorName: result.counselorName,
        version: result.version,
      });
      onOpenChange(false);
    } catch (err) {
      // Phase 3I Slice 7 (PD-S7-06): stale-ownership vs stale-Version share the 409 status;
      // surface the server's message verbatim (falls back to the standard stale-session copy).
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
      } else {
        toast.error(getApiErrorMessage(err, 'Failed to assign session.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToMe = () => {
    if (!currentUserId) return;
    void completeAssign(currentUserId, 'Session assigned to you.');
  };

  const handleConfirmPeer = () => {
    if (!selectedId) return;
    const name = selected ? counselorOptionLabel(selected) : 'counsellor';
    void completeAssign(selectedId, `Session assigned to ${name}.`);
  };

  const assignDisabled =
    !selectedId ||
    submitting ||
    loadingList ||
    listState === 'empty' ||
    listState === 'error' ||
    listState === 'no-match';

  return (
    <CounsellingDialog open={open} onOpenChange={onOpenChange}>
      <CounsellingDialogContent
        className="max-w-md"
        data-testid="waiting-list-assign-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <CounsellingDialogHeader>
          <CounsellingDialogTitle>Assign session</CounsellingDialogTitle>
          {patientName ? (
            <p className="text-sm font-medium text-foreground">{patientName}</p>
          ) : null}
          <CounsellingDialogDescription>
            {patientName
              ? 'Choose the counselling owner for this session.'
              : 'Choose the counselling owner for this unassigned session.'}
          </CounsellingDialogDescription>
        </CounsellingDialogHeader>

        <div className="space-y-3 py-1">
          {showAssignToMe ? (
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAssignToMe}
              disabled={submitting || loadingList || !currentUserId}
              data-testid="waiting-list-assign-to-me"
            >
              Assign to me
            </CounsellingButton>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <CounsellingLabel htmlFor="waiting-list-assign-counsellor">
                Counselling owner
              </CounsellingLabel>
              {!loadingList && !listError ? (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="waiting-list-assign-eligible-count"
                >
                  {formatEligibleCounsellorCount(counselors.length)}
                </span>
              ) : null}
            </div>

            {listState === 'loading' ? (
              <CounsellingStatusMessage
                tone="loading"
                title="Loading counsellors…"
              />
            ) : null}

            {listState === 'error' ? (
              <CounsellingStatusMessage
                tone="error"
                title={listError ?? 'Could not load counsellors.'}
                action={
                  <CounsellingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadCounselors()}
                    disabled={submitting}
                  >
                    Retry
                  </CounsellingButton>
                }
              />
            ) : null}

            {listState === 'empty' ? (
              <CounsellingStatusMessage
                tone="info"
                title="No eligible counsellors available"
              />
            ) : null}

            {listState === 'ready' || listState === 'no-match' ? (
              <>
                <CounsellingSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search counsellor"
                  disabled={submitting}
                  data-testid="waiting-list-assign-search"
                />
                {listState === 'no-match' ? (
                  <p
                    className="text-xs text-muted-foreground"
                    role="status"
                    data-testid="waiting-list-assign-no-match"
                  >
                    No counsellors match &quot;{searchQuery.trim()}&quot;
                  </p>
                ) : (
                  <CounsellingSelect
                    value={selectedId || undefined}
                    onValueChange={setSelectedId}
                    disabled={submitting || filteredCounselors.length === 0}
                  >
                    <CounsellingSelectTrigger
                      id="waiting-list-assign-counsellor"
                      data-testid="waiting-list-assign-counsellor"
                      aria-label="Select counsellor"
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
                )}
              </>
            ) : null}
          </div>
        </div>

        <CounsellingDialogFooter className={cn('gap-2')}>
          <CounsellingButton
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </CounsellingButton>
          <CounsellingButton
            type="button"
            onClick={handleConfirmPeer}
            disabled={assignDisabled}
            data-testid="waiting-list-assign-confirm"
          >
            {submitting ? 'Assigning…' : 'Assign'}
          </CounsellingButton>
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
