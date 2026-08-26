'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { integrationHealthApi } from '@/lib/api/integration-health.api';
import {
  canViewIntegrationHealth,
  formatOldestPending,
  groupDeadByError,
  isMappingDefect,
  retryingCount,
  type OutboxDeadLetter,
  type OutboxEventDetail,
  type OutboxSource,
  type OutboxStats,
} from '@/lib/billing/integration-health';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function fmtWhen(iso?: string | null) {
  return iso
    ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
}

function emptyStats(): OutboxStats {
  return { pending: 0, failed: 0, dead: 0, processed: 0, processing: 0, published24h: 0, byType: [] };
}

export default function IntegrationHealthPage() {
  const permissions = useAuthStore((s) => s.permissions);
  const allowed = canViewIntegrationHealth(permissions);
  const [ip, setIp] = useState<OutboxStats | null>(null);
  const [billing, setBilling] = useState<OutboxStats | null>(null);
  const [dead, setDead] = useState<OutboxDeadLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspect, setInspect] = useState<OutboxEventDetail | null>(null);
  const [abandonRow, setAbandonRow] = useState<OutboxDeadLetter | null>(null);
  const [abandonReason, setAbandonReason] = useState('');
  const [compensating, setCompensating] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ipStats, billStats, ipDead, billDead] = await Promise.all([
        integrationHealthApi.getIpStats(),
        integrationHealthApi.getBillingStats(),
        integrationHealthApi.getIpDead(),
        integrationHealthApi.getBillingDead(),
      ]);
      setIp(ipStats);
      setBilling(billStats);
      setDead([...billDead, ...ipDead].sort((a, b) => {
        const at = new Date(a.lastAttemptAt ?? a.occurredAt).getTime();
        const bt = new Date(b.lastAttemptAt ?? b.occurredAt).getTime();
        return bt - at;
      }));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integration health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  const totals = useMemo(() => {
    const a = ip ?? emptyStats();
    const b = billing ?? emptyStats();
    const oldest = [a.oldestPendingAt, b.oldestPendingAt]
      .filter(Boolean)
      .sort()[0] ?? null;
    return {
      published24h: a.published24h + b.published24h,
      pending: a.pending + b.pending,
      retrying: retryingCount(a) + retryingCount(b),
      dead: a.dead + b.dead,
      oldestPendingAt: oldest,
    };
  }, [ip, billing]);

  const groups = useMemo(() => groupDeadByError(dead), [dead]);
  const sharedCause = groups.find((g) => g.count > 1);

  async function openInspect(row: OutboxDeadLetter) {
    setBusy(true);
    setError('');
    try {
      const detail = row.source === 'IP'
        ? await integrationHealthApi.getIpEvent(row.id)
        : await integrationHealthApi.getBillingEvent(row.id);
      setInspect(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not inspect event');
    } finally {
      setBusy(false);
    }
  }

  async function requeue(ids: string[], source: OutboxSource) {
    setBusy(true);
    setError('');
    try {
      if (source === 'IP') await integrationHealthApi.requeueIp(ids);
      else await integrationHealthApi.requeueBilling(ids);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Requeue failed');
    } finally {
      setBusy(false);
    }
  }

  async function bulkRequeue() {
    const rows = dead.filter((d) => selected.has(d.id) && !isMappingDefect(d));
    const ipIds = rows.filter((r) => r.source === 'IP').map((r) => r.id);
    const billIds = rows.filter((r) => r.source === 'Billing').map((r) => r.id);
    setBusy(true);
    setError('');
    try {
      if (ipIds.length) await integrationHealthApi.requeueIp(ipIds);
      if (billIds.length) await integrationHealthApi.requeueBilling(billIds);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk requeue failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitAbandon() {
    if (!abandonRow) return;
    if (!abandonReason.trim()) return;
    if (abandonRow.isFinancial && !compensating.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (abandonRow.source === 'IP') {
        await integrationHealthApi.abandonIp(abandonRow.id, abandonReason.trim(), compensating.trim() || undefined);
      } else {
        await integrationHealthApi.abandonBilling(abandonRow.id, abandonReason.trim(), compensating.trim() || undefined);
      }
      setAbandonRow(null);
      setAbandonReason('');
      setCompensating('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Abandon failed');
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-xl font-semibold">Integration health</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You need <code>integration.admin</code> to view outbox dead letters and requeue events.
        </p>
      </div>
    );
  }

  const selectable = dead.filter((d) => !isMappingDefect(d));
  const healthy = totals.dead === 0 && totals.retrying === 0;

  return (
    <div className="ip-target pb-8">
      <div className="frame">
      <div className="app-header">
        <h1>Integration health</h1>
        <span className="scope">IP Management and Billing outboxes · live</span>
        <span className="spacer" />
        <button type="button" className="btn sm" onClick={() => void load()} disabled={loading || busy}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="callout danger" style={{ margin: 12 }}>{error}</div>}

      <div className="kpis">
        <div className="kpi is-inhouse">
          <div className="label">Published 24h</div>
          <div className="value num">{totals.published24h}</div>
        </div>
        <div className="kpi">
          <div className="label">Pending</div>
          <div className="value num">{totals.pending}</div>
        </div>
        <div className={`kpi ${totals.retrying > 0 ? 'is-ot' : ''}`}>
          <div className="label">Retrying</div>
          <div className="value num">{totals.retrying}</div>
        </div>
        <div className={`kpi ${totals.dead > 0 ? 'is-alert' : ''}`}>
          <div className="label">Dead-lettered</div>
          <div className="value num">{totals.dead}</div>
        </div>
        <div className="kpi">
          <div className="label">Oldest pending</div>
          <div className="value num">{formatOldestPending(totals.oldestPendingAt)}</div>
        </div>
      </div>

      {healthy && !loading && (
        <div className="callout info" style={{ margin: 12 }}>
          All integrations healthy. 0 dead · {totals.pending} pending within normal retry · oldest unprocessed{' '}
          {formatOldestPending(totals.oldestPendingAt)}.
        </div>
      )}

      <div className="cols-2" style={{ padding: '14px 16px' }}>
        <TypePanel title="IP Management outbox" subtitle="integration_outbox_event" stats={ip} />
        <TypePanel title="Billing → CCMS outbox" subtitle="billing_ccms_outbox" stats={billing} />
      </div>

      {sharedCause && (
        <div className="callout warn" style={{ margin: 12 }}>
          <b>{sharedCause.count} dead events share one root cause</b>
          {' '}— {sharedCause.error}. Requeue them together after the consumer is healthy.
          Mapping defects stay out of bulk requeue.
        </div>
      )}

      <div className="group-h">
        <span>Dead letters ({dead.length})</span>
        <span className="src">requeue resets the attempt counter and preserves the idempotency key</span>
        <span className="spacer" />
        <button
          type="button"
          className="btn sm"
          disabled={busy || selectable.length === 0}
          onClick={() => setSelected(new Set(selectable.map((d) => d.id)))}
        >
          Select replayable
        </button>
        <button type="button" className="btn sm primary" disabled={busy || selected.size === 0} onClick={() => void bulkRequeue()}>
          Requeue selected ({selected.size})
        </button>
      </div>
      {dead.length === 0 ? (
        <p className="empty">No dead letters.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th />
              <th>Event</th>
              <th>Source</th>
              <th>Subject</th>
              <th>Failed at</th>
              <th>Attempts</th>
              <th>Last error</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {dead.map((row) => (
              <tr key={`${row.source}-${row.id}`}>
                <td>
                  {!isMappingDefect(row) && (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        setSelected(next);
                      }}
                    />
                  )}
                </td>
                <td className="mono">{row.eventType}</td>
                <td>{row.source}</td>
                <td className="cell-sub">{row.subject}</td>
                <td>{fmtWhen(row.lastAttemptAt ?? row.occurredAt)}</td>
                <td className="num">{row.retryCount}</td>
                <td className="cell-sub" title={row.error ?? ''}>{row.error ?? '—'}</td>
                <td className="whitespace-nowrap">
                  <div className="row">
                    <button type="button" className="btn sm" disabled={busy} onClick={() => void openInspect(row)}>Inspect</button>
                    {isMappingDefect(row) ? (
                      <Link href="/dashboard/admin/charge-mapping" className="btn sm">Map item first</Link>
                    ) : (
                      <button type="button" className="btn sm primary" disabled={busy} onClick={() => void requeue([row.id], row.source)}>Requeue</button>
                    )}
                    <button
                      type="button"
                      className="btn sm danger"
                      disabled={busy}
                      onClick={() => {
                        setAbandonRow(row);
                        setAbandonReason('');
                        setCompensating('');
                      }}
                    >
                      Abandon
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>

      <Dialog open={!!inspect} onOpenChange={(open) => !open && setInspect(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Event {inspect?.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>Payload is shown with patient identifiers masked. Viewing is audited.</DialogDescription>
          </DialogHeader>
          {inspect && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Type</dt><dd className="font-mono text-xs">{inspect.eventType}</dd>
              <dt className="text-slate-500">Source</dt><dd>{inspect.source}</dd>
              <dt className="text-slate-500">Subject</dt><dd>{inspect.subject}</dd>
              <dt className="text-slate-500">Correlation</dt><dd className="font-mono text-xs">{inspect.correlationId ?? '—'}</dd>
              <dt className="text-slate-500">Attempts</dt><dd>{inspect.retryCount} of 8</dd>
              <dt className="text-slate-500">Last error</dt><dd className="text-xs col-span-1">{inspect.error ?? '—'}</dd>
            </dl>
          )}
          <pre className="text-xs bg-slate-50 border rounded-md p-3 overflow-auto max-h-56">
            {inspect?.maskedPayloadJson ?? '{}'}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspect(null)}>Close</Button>
            {inspect && !isMappingDefect(inspect) && (
              <Button
                disabled={busy}
                onClick={() => {
                  const src = inspect.source;
                  const id = inspect.id;
                  setInspect(null);
                  void requeue([id], src);
                }}
              >
                Requeue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!abandonRow} onOpenChange={(open) => !open && setAbandonRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abandon {abandonRow?.eventType}</DialogTitle>
            <DialogDescription>
              The downstream effect will never happen. For a financial event this is a hole in the ledger unless a
              compensating action is recorded.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm space-y-1 block">
            <span>Reason <span className="text-red-600">*</span></span>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={3}
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
            />
          </label>
          <label className="text-sm space-y-1 block">
            <span>Compensating action {abandonRow?.isFinancial ? <span className="text-red-600">*</span> : null}</span>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={2}
              value={compensating}
              onChange={(e) => setCompensating(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbandonRow(null)}>Cancel</Button>
            <Button
              disabled={
                busy
                || !abandonReason.trim()
                || (!!abandonRow?.isFinancial && !compensating.trim())
              }
              onClick={() => void submitAbandon()}
            >
              Abandon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypePanel({ title, subtitle, stats }: { title: string; subtitle: string; stats: OutboxStats | null }) {
  const rows = stats?.byType ?? [];
  return (
    <div className="panel">
      <p className="panel-h">{title} · <code>{subtitle}</code></p>
      <table className="grid" style={{ border: '1px solid var(--ip-line)', borderRadius: 6, overflow: 'hidden' }}>
        <thead>
          <tr>
            <th>Event type</th>
            <th>Pending</th>
            <th>Retrying</th>
            <th>Dead</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="muted">No pending, retrying or dead events.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.eventType}>
              <td className="mono">{r.eventType}</td>
              <td className="num">{r.pending}</td>
              <td className="num" style={r.retrying ? { color: 'var(--ip-ot)' } : undefined}>{r.retrying}</td>
              <td className="num" style={r.dead ? { color: 'var(--ip-danger)' } : undefined}>{r.dead}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
