'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useHasPermission } from '@/hooks/use-permissions';
import { LMS_CRITICAL_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  acknowledgeLmsCriticalEvent,
  createLmsCriticalEvent,
  listLmsCriticalEventsForResult,
  parseLmsTestingApiError,
  type LmsCriticalEventDto,
} from '@/lib/lms/lms-testing.api';

function criticalStatusLabel(status: string): string {
  if (status === 'Open') return 'Open';
  if (status === 'Acknowledged') return 'Acknowledged';
  return status;
}

export function CriticalResultPanel(props: {
  resultId: string | null;
  resultStatus: string | null;
  currentVersionNumber: number | null;
  operatingBranchId: string;
}) {
  const canView = useHasPermission(LMS_CRITICAL_PERMISSIONS.view);
  const canManage = useHasPermission(LMS_CRITICAL_PERMISSIONS.manage);
  const canAcknowledge = useHasPermission(LMS_CRITICAL_PERMISSIONS.acknowledge);

  const [events, setEvents] = useState<LmsCriticalEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [evidence, setEvidence] = useState('');
  const [confirmClassify, setConfirmClassify] = useState(false);

  const eligible =
    props.resultStatus === 'TechnicalVerified' || props.resultStatus === 'ClinicallyAuthorized';
  const openEvent = events.find((e) => e.status === 'Open') ?? null;
  const latest = events[0] ?? null;

  const load = useCallback(async () => {
    if (!canView || !props.resultId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listLmsCriticalEventsForResult(props.resultId, props.operatingBranchId);
      setEvents(rows);
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Failed to load Critical events.');
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [canView, props.resultId, props.operatingBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) return null;
  if (!props.resultId) return null;

  async function onClassify() {
    if (!canManage || !props.resultId || !eligible) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const evt = await createLmsCriticalEvent(props.resultId, {
        operatingBranchId: props.operatingBranchId,
        expectedResultVersionNumber: props.currentVersionNumber ?? undefined,
      });
      setConfirmClassify(false);
      setSuccess(
        evt.notificationIntentStatus === 'Emitted'
          ? 'Critical event created. In-app notification intent emitted (not acknowledgement).'
          : `Critical event created. Notification intent: ${evt.notificationIntentStatus} (event remains Open; not acknowledged).`,
      );
      await load();
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Critical classification failed.');
      setError(parsed.message);
    } finally {
      setBusy(false);
    }
  }

  async function onAcknowledge() {
    if (!canAcknowledge || !props.resultId || !openEvent) return;
    if (!evidence.trim()) {
      setError('Acknowledgement evidence is required.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await acknowledgeLmsCriticalEvent(props.resultId, openEvent.id, {
        operatingBranchId: props.operatingBranchId,
        expectedRowVersion: openEvent.rowVersion,
        acknowledgementEvidence: evidence,
      });
      setEvidence('');
      setSuccess('Critical event acknowledged. Result status is unchanged.');
      await load();
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Critical acknowledgement failed.');
      setError(parsed.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-4"
      data-testid="result-critical-panel"
    >
      <div>
        <h2 className="text-sm font-semibold text-rose-950">Critical Results</h2>
        <p className="mt-1 text-xs text-rose-900" data-testid="result-critical-honesty">
          Critical is a separate safety event — not Result status, Final, Released, or patient-visible.
          Classification is manual; no automated thresholds.
        </p>
      </div>

      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Result status</dt>
          <dd data-testid="result-critical-result-status">{props.resultStatus || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Critical</dt>
          <dd data-testid="result-critical-status">
            {loading ? 'Loading…' : latest ? criticalStatusLabel(latest.status) : 'None'}
          </dd>
        </div>
        {latest && (
          <>
            <div>
              <dt className="text-xs text-muted-foreground">Bound Result version</dt>
              <dd data-testid="result-critical-version">{latest.resultVersionNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Notification intent</dt>
              <dd data-testid="result-critical-notify-status">{latest.notificationIntentStatus}</dd>
            </div>
          </>
        )}
      </dl>

      {error && (
        <div
          className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900"
          role="alert"
          data-testid="result-critical-error"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900"
          data-testid="result-critical-success"
        >
          {success}
        </div>
      )}

      {eligible && !latest && canManage && (
        <div className="space-y-2">
          {!confirmClassify ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmClassify(true)}
              data-testid="result-critical-classify"
            >
              Mark as Critical
            </Button>
          ) : (
            <div className="space-y-2 rounded border border-rose-300 bg-white p-3">
              <p className="text-sm" data-testid="result-critical-classify-confirm">
                Classify Result version {props.currentVersionNumber ?? '—'} as Critical?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void onClassify()}
                  data-testid="result-critical-classify-submit"
                >
                  {busy ? 'Classifying…' : 'Confirm classification'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmClassify(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {props.resultStatus === 'Draft' && (
        <p className="text-xs text-amber-900" data-testid="result-critical-draft-blocked">
          Draft results cannot be classified as Critical.
        </p>
      )}

      {openEvent && canAcknowledge && (
        <div className="space-y-2 rounded border bg-white p-3">
          <Label htmlFor="critical-ack-evidence">Acknowledgement evidence</Label>
          <Textarea
            id="critical-ack-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={busy}
            data-testid="result-critical-ack-evidence"
            placeholder="Required — e.g. clinician contact / read-back notes"
          />
          <Button
            type="button"
            disabled={busy || !evidence.trim()}
            onClick={() => void onAcknowledge()}
            data-testid="result-critical-acknowledge"
          >
            {busy ? 'Acknowledging…' : 'Acknowledge Critical Result'}
          </Button>
        </div>
      )}

      {latest?.status === 'Acknowledged' && (
        <dl className="grid gap-1 text-xs md:grid-cols-2" data-testid="result-critical-ack-meta">
          <div>
            <dt className="text-muted-foreground">Acknowledged by</dt>
            <dd>{latest.acknowledgedByUserId || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Acknowledged at (UTC)</dt>
            <dd>{latest.acknowledgedAtUtc || '—'}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
