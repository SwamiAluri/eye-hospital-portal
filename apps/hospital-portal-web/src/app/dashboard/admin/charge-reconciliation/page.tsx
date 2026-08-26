'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  chargeReconciliationApi,
  type ChargeReconciliationReport,
  type ReconciliationRow,
  type WastageReport,
} from '@/lib/api/charge-reconciliation.api';
import {
  BUCKET_COPY,
  canViewChargeReconciliation,
  localDateToUtcRange,
  reconciliationCsv,
} from '@/lib/billing/charge-reconciliation';
import { formatInr } from '@/lib/billing/charge-mapping';

const DETAIL: { n: number; title: string; key: keyof ChargeReconciliationReport }[] = [
  { n: 1, title: 'Implanted, not charged', key: 'implantedNotCharged' },
  { n: 2, title: 'Charged, not implanted', key: 'chargedNotImplanted' },
  { n: 3, title: 'Stock out, no usage recorded', key: 'stockOutNoUsage' },
  { n: 4, title: 'Package / consumable overlap', key: 'packageConsumableOverlap' },
  { n: 5, title: 'Unmapped items', key: 'unmappedItems' },
];

function fmtWhen(iso?: string) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  return isoDate(d);
}

export default function ChargeReconciliationPage() {
  const permissions = useAuthStore((s) => s.permissions);
  const allowed = canViewChargeReconciliation(permissions);
  const searchParams = useSearchParams();
  const [fromDate, setFromDate] = useState(() => {
    const raw = searchParams.get('fromUtc');
    return raw ? raw.slice(0, 10) : defaultFrom();
  });
  const [toDate, setToDate] = useState(() => {
    const raw = searchParams.get('toUtc');
    if (!raw) return isoDate(new Date());
    const exclusive = new Date(raw);
    exclusive.setUTCDate(exclusive.getUTCDate() - 1);
    return isoDate(exclusive);
  });
  const [report, setReport] = useState<ChargeReconciliationReport | null>(null);
  const [wastage, setWastage] = useState<WastageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openBucket, setOpenBucket] = useState(1);

  const range = useMemo(() => localDateToUtcRange(fromDate, toDate), [fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, w] = await Promise.all([
        chargeReconciliationApi.run(range.fromUtc, range.toUtc),
        chargeReconciliationApi.getWastage(range.fromUtc, range.toUtc),
      ]);
      setReport(r);
      setWastage(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation');
    } finally {
      setLoading(false);
    }
  }, [range.fromUtc, range.toUtc]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-xl font-semibold">Charge reconciliation</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You need <code>bill.view</code> to see implant, stock and charge exceptions.
        </p>
      </div>
    );
  }

  const rowsFor = (key: keyof ChargeReconciliationReport): ReconciliationRow[] => {
    const value = report?.[key];
    return Array.isArray(value) ? (value as ReconciliationRow[]) : [];
  };

  return (
    <div className="ip-target pb-8">
      <div className="frame">
      <div className="app-header">
        <h1>Charge reconciliation</h1>
        <span className="scope">
          Clinical use, stock movement and billed charges. Wastage is a hospital write-off, never a patient charge.
          {report && (
            <>
              {' '}Window {new Date(report.fromUtc).toLocaleDateString('en-IN')}–{new Date(report.toUtc).toLocaleDateString('en-IN')}
              {' · '}ran {fmtWhen(report.generatedAt)}.
            </>
          )}
        </span>
        <span className="spacer" />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" aria-label="From" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" aria-label="To" />
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            if (!report) return;
            const blob = new Blob(['\uFEFF' + reconciliationCsv(report)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `charge-reconciliation-${fromDate}-to-${toDate}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!report}
        >
          Export
        </button>
        <button type="button" className="btn sm primary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Running…' : '↻ Re-run now'}
        </button>
      </div>

      {error && <div className="callout danger" style={{ margin: 12 }}>{error}</div>}

      <table className="grid">
        <thead>
          <tr>
            <th>#</th>
            <th>Exception bucket</th>
            <th>Cases</th>
            <th className="right">Value</th>
            <th>Meaning</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(report?.buckets ?? []).map((b) => (
            <tr key={b.number} className={openBucket === b.number ? 'row-selected' : ''}>
              <td className="num">{b.number}</td>
              <td><div className="cell-primary">{b.title}</div></td>
              <td className="num">{b.count}</td>
              <td className="num right" style={b.count > 0 && b.number !== 3 ? { color: 'var(--ip-danger)' } : undefined}>
                {b.number === 3 ? '—' : formatInr(b.value)}
              </td>
              <td className="cell-sub">{BUCKET_COPY[b.number]}</td>
              <td>
                {b.number === 5 ? (
                  <Link href="/dashboard/admin/charge-mapping" className="btn sm">Charge mapping</Link>
                ) : (
                  <button type="button" className={`btn sm ${openBucket === b.number ? 'primary' : ''}`} onClick={() => setOpenBucket(b.number)}>
                    Review
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {DETAIL.filter((d) => d.n === openBucket).map((d) => {
        const rows = rowsFor(d.key);
        return (
          <div key={d.n}>
            <div className="group-h">
              <span>Bucket {d.n} — {d.title}</span>
              <span className="amt">{rows.length} case(s)</span>
            </div>
            {rows.length === 0 ? (
              <p className="empty">No exceptions in this bucket.</p>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Patient / item</th>
                    <th>Serial</th>
                    <th>When</th>
                    <th>Reason</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.sourceRefId ?? r.itemId ?? i}`}>
                      <td>
                        <div className="cell-primary">{r.patientName ?? r.billNumber ?? '—'}</div>
                        <div className="cell-sub">{r.itemName}</div>
                      </td>
                      <td className="mono">{r.serialNumber ?? '—'}</td>
                      <td>{fmtWhen(r.occurredAt)}</td>
                      <td className="cell-sub">{r.reason}</td>
                      <td className="num right">{r.amount ? formatInr(r.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <div className="group-h">
        <span>Wastage — write-offs, never charged to a patient</span>
        <span className="amt">
          Clinical {formatInr(wastage?.usageTotalCost ?? 0)} · Ledger {formatInr(wastage?.ledgerTotalCost ?? 0)}
          {wastage && wastage.delta !== 0 && (
            <span style={{ color: 'var(--ip-danger)', marginLeft: 8 }}>delta {formatInr(wastage.delta)}</span>
          )}
        </span>
      </div>
      <div className="kpis">
        {(wastage?.byReason ?? []).map((g) => (
          <div key={g.key} className="kpi">
            <div className="label">{g.key}</div>
            <div className="value num">{g.count}</div>
            <div className="src">{formatInr(g.cost)}</div>
          </div>
        ))}
      </div>
      <table className="grid">
        <thead>
          <tr>
            <th>When</th>
            <th>Item</th>
            <th>Serial</th>
            <th>Reason</th>
            <th>Ledger</th>
            <th className="right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {(wastage?.lines ?? []).map((l, i) => (
            <tr key={`${l.serialNumber ?? l.itemId ?? i}`}>
              <td>{fmtWhen(l.occurredAt)}</td>
              <td>{l.itemName}</td>
              <td className="mono">{l.serialNumber ?? '—'}</td>
              <td className="cell-sub">{l.reason}</td>
              <td>{l.hasLedgerMatch ? 'Matched' : 'Unmatched'}</td>
              <td className="num right">{formatInr(l.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(wastage?.lines.length ?? 0) === 0 && (
        <p className="empty">No write-offs in this window.</p>
      )}
      </div>
    </div>
  );
}
