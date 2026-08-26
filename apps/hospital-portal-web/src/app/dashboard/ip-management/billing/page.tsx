'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { resolveBillingDashboardAccess, type BillingDashboardAccess } from '@/lib/ip-management/billing-dashboard-access';
import { useIpBillingDashboardQuery } from '@/hooks/use-ip-billing-dashboard-query';
import type { IpBillingDashboard } from '@/lib/api/opd-billing.api';

function fmtINR(v: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Access = BillingDashboardAccess;

export default function BillingDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading billing…</div>}>
      <BillingDashboardPageInner />
    </Suspense>
  );
}

function BillingDashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusJourneyId = searchParams.get('journeyId');
  const focusBillId = searchParams.get('billId');
  const { user, roles, permissions } = useAuthStore();
  const branchId = user?.branchId;
  const access = resolveBillingDashboardAccess({ roles, userType: user?.userType, permissions });

  const [preset, setPreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [worklistTab, setWorklistTab] = useState<'all' | 'outstanding' | 'refunds' | 'unbilled' | 'claims'>('all');

  const dashQuery = useIpBillingDashboardQuery({
    branchId,
    preset,
    customFrom,
    customTo,
    enabled: Boolean(branchId),
  });
  const data = dashQuery.data ?? null;
  const isLoading = dashQuery.isLoading || dashQuery.isFetching;
  const error = dashQuery.error instanceof Error ? dashQuery.error.message : dashQuery.error ? 'Failed to load billing dashboard' : '';

  const rows = useMemo(() => {
    const list = data?.patients ?? [];
    let filtered = lifecycleFilter ? list.filter(p => p.lifecycle === lifecycleFilter) : list;
    switch (worklistTab) {
      case 'outstanding':
        filtered = filtered.filter(
          p =>
            p.patientOutstanding > 0 &&
            /ready.?for.?discharge|discharg|post.?op|surgery.?complet/i.test(p.lifecycle),
        );
        if (filtered.length === 0) {
          filtered = (lifecycleFilter ? list.filter(p => p.lifecycle === lifecycleFilter) : list).filter(
            p => p.patientOutstanding > 0,
          );
        }
        break;
      case 'unbilled':
        filtered = filtered.filter(
          p => p.chargeStatus && p.chargeStatus !== 'complete',
        );
        break;
      case 'claims':
        filtered = filtered.filter(p => p.payerOutstanding > 0);
        break;
      case 'refunds':
        // Refund queue is not row-level on this dashboard — empty filter; panel below.
        filtered = [];
        break;
      default:
        break;
    }
    if (focusJourneyId) {
      const hit = filtered.filter(p => p.journeyId === focusJourneyId);
      if (hit.length > 0) return [...hit, ...filtered.filter(p => p.journeyId !== focusJourneyId)];
    }
    if (focusBillId) {
      const hit = filtered.filter(p => p.billId === focusBillId);
      if (hit.length > 0) return [...hit, ...filtered.filter(p => p.billId !== focusBillId)];
    }
    return filtered;
  }, [data, lifecycleFilter, worklistTab, focusJourneyId, focusBillId]);

  const openBill = (billId: string) => router.push(`/dashboard/billing/opd?billId=${billId}`);

  return (
    <div className="ip-target pb-8">
      <div className="frame">
      <div className="app-header">
        <h1>IP Billing</h1>
        <span className="scope">{data?.rangeLabel ?? 'Authoritative OpdBill ledger'}</span>
        <span className="spacer" />
        <button type="button" onClick={() => router.push('/dashboard/ip-management')} className="btn sm">← Census</button>
        {(['today', 'yesterday', 'this_week', 'this_month', 'custom'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={`btn sm ${preset === p ? 'primary' : ''}`}
          >
            {p.replace('_', ' ')}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input" style={{ width: 140 }} />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input" style={{ width: 140 }} />
          </>
        )}
        <button type="button" onClick={() => void dashQuery.refetch()} disabled={isLoading} className="btn sm">↻ Refresh</button>
      </div>

      {(access === 'full' || access === 'finance') && data && (
        <div className="kpis">
          <div className="kpi">
            <div className="label">Active IP bills</div>
            <div className="value num">{data.patientCount ?? 0}</div>
          </div>
          <div className="kpi">
            <div className="label">Billed</div>
            <div className="value num">{fmtINR(data.totalBilled ?? 0)}</div>
          </div>
          <div className="kpi">
            <div className="label">Collected</div>
            <div className="value num">{fmtINR(data.totalCollected ?? 0)}</div>
          </div>
          <div className="kpi is-alert">
            <div className="label">Outstanding</div>
            <div className="value num">{fmtINR(data.patientOutstanding ?? 0)}</div>
          </div>
          <button type="button" className="kpi is-ot" style={{ textAlign: 'left' }} onClick={() => router.push(reconciliationHref(data))}>
            <div className="label">Unbilled activity</div>
            <div className="value num">{fmtINR(data.unbilledActivityAmount ?? 0)}</div>
            <div className="src">{data.unbilledActivityCount ?? 0} lines · from reconciliation</div>
          </button>
        </div>
      )}

      {data && (
        <p className="text-xs text-gray-500">
          {data.rangeLabel}. Billed on <span className="font-mono">{data.billedDateBasis}</span>.
          Collections/refunds on <span className="font-mono">{data.collectionDateBasis}</span>.
          Admission on <span className="font-mono">{data.admissionDateBasis ?? 'patient_journey.admitted_at'}</span> (display only — not used in KPIs).
          Outstanding is as-of period end.
        </p>
      )}

      {error && <div className="callout danger" style={{ margin: 12 }}>{error}</div>}

      {access === 'ward' && (
        <div className="callout warn" style={{ margin: 12 }}>
          Ward view: patient financial blockers only. Full ledger stays in Billing.
        </div>
      )}
      {access === 'doctor' && (
        <div className="callout info" style={{ margin: 12 }}>
          Clinical view: billed amount and patient outstanding only.
        </div>
      )}
      {(access === 'finance' || access === 'full') && data && (
        <div className="callout warn" style={{ margin: 12 }}>
          <div className="row">
            <span><b>Reconciliation queue:</b> {data.pendingRefundCount ?? 0} refunds pending ({fmtINR(data.pendingRefundAmount ?? 0)})</span>
            <span>{data.pendingCreditApprovalCount ?? 0} credit bills awaiting approval</span>
            <button type="button" onClick={() => router.push('/dashboard/billing/opd')} className="btn sm">Open Billing approvals</button>
            <Link href="/dashboard/admin/charge-reconciliation" className="btn sm">Charge reconciliation</Link>
            <Link href="/dashboard/ip-management/throughput" className="btn sm">Slot throughput</Link>
          </div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi is-alert">
          <div className="label">Patient outstanding</div>
          <div className="value num">{fmtINR(data?.patientOutstanding ?? 0)}</div>
          <div className="src">As of period end</div>
        </div>
        {access === 'full' || access === 'finance' ? (
          <>
            <div className="kpi is-ot">
              <div className="label">Insurance / TPA outstanding</div>
              <div className="value num">{fmtINR(data?.payerOutstanding ?? 0)}</div>
              <div className="src">As of period end</div>
            </div>
            <div className="kpi">
              <div className="label">Refunds</div>
              <div className="value num">{fmtINR(data?.refunds ?? 0)}</div>
              <div className="src">Payment date in range</div>
            </div>
            <div className="kpi">
              <div className="label">Adjustments</div>
              <div className="value num">{fmtINR(data?.adjustments ?? 0)}</div>
              <div className="src">Payment date in range</div>
            </div>
          </>
        ) : null}
      </div>

      {(access === 'full' || access === 'finance') && (
        <div className="kpis">
          {(data?.pipeline ?? []).map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setLifecycleFilter(f => f === p.key ? '' : p.key)}
              className={`kpi ${lifecycleFilter === p.key ? 'is-active' : ''}`}
            >
              <div className="label">{p.label}</div>
              <div className="value num">{p.count}</div>
              <div className="src">{fmtINR(p.billedAmount)}</div>
            </button>
          ))}
          {(!data?.pipeline || data.pipeline.length === 0) && <p className="muted" style={{ padding: 8 }}>No bills in this bill-date range.</p>}
        </div>
      )}

      {(access === 'full' || access === 'finance') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Payer mix (billed)</h2>
            <p className="text-xs text-gray-400 mb-3">Who is financially responsible — not how cash was received.</p>
            <Bar segments={(data?.payerMix ?? []).map((s, i) => ({ ...s, color: PAYER_COLORS[i % PAYER_COLORS.length] }))} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Payment instruments (collected)</h2>
            <p className="text-xs text-gray-400 mb-3">From opd_bill_payments.payment_mode on payment date.</p>
            <Bar segments={(data?.paymentInstruments ?? []).map((s, i) => ({ ...s, color: INST_COLORS[i % INST_COLORS.length] }))} />
          </div>
        </div>
      )}

      {(access === 'full' || access === 'finance') && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Receivable aging</h2>
          <p className="text-xs text-gray-400 mb-3">Days since bill date, as of period end. Patient and payer shown separately.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(data?.aging ?? []).map(a => (
              <div key={a.key} className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{a.label}</p>
                <p className="text-lg font-bold text-gray-900">{a.count} bills</p>
                <p className="text-xs text-red-600">Patient {fmtINR(a.patientOutstanding)}</p>
                <p className="text-xs text-orange-600">Payer {fmtINR(a.payerOutstanding)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="tabs">
          <span className="tab active" style={{ pointerEvents: 'none' }}>
            {access === 'ward' ? 'Patients with financial blockers' : 'Inpatient bills'}
          </span>
          <span className="spacer" />
          {(access === 'full' || access === 'finance') && (
            <>
              {(
                [
                  { key: 'all' as const, label: 'All bills' },
                  { key: 'outstanding' as const, label: 'Outstanding at discharge' },
                  {
                    key: 'refunds' as const,
                    label: `Refunds pending${data?.pendingRefundCount != null ? ` (${data.pendingRefundCount})` : ''}`,
                  },
                  {
                    key: 'unbilled' as const,
                    label: `Unbilled implants${data?.unbilledActivityCount != null ? ` (${data.unbilledActivityCount})` : ''}`,
                  },
                  { key: 'claims' as const, label: 'Claims not yet settled' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={worklistTab === tab.key}
                  onClick={() => setWorklistTab(tab.key)}
                  className={`tab ${worklistTab === tab.key ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </>
          )}
        </div>

        {worklistTab === 'refunds' && (access === 'full' || access === 'finance') && (
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/60 text-sm text-amber-900 flex flex-wrap gap-4 items-center">
            <p>
              <span className="font-semibold">{data?.pendingRefundCount ?? 0} refunds</span> awaiting approval
              ({fmtINR(data?.pendingRefundAmount ?? 0)}). Separation of duties: approve in Billing, not here.
            </p>
            <button type="button" onClick={() => router.push('/dashboard/billing/opd')} className="text-blue-700 font-medium">
              Open Billing approvals →
            </button>
          </div>
        )}

        {worklistTab === 'unbilled' && (access === 'full' || access === 'finance') && (
          <div className="px-5 py-3 border-b border-orange-100 bg-orange-50/50 text-xs text-orange-900 flex flex-wrap gap-3 items-center">
            <p>
              Implant/consumable lines recorded in theatre but not yet charged — {data?.unbilledActivityCount ?? 0} line(s),{' '}
              {fmtINR(data?.unbilledActivityAmount ?? 0)}.
            </p>
            <Link href={reconciliationHref(data)} className="text-blue-700 font-medium">
              Open charge reconciliation →
            </Link>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="grid">
            <thead>
              <tr>
                <th>Patient</th>
                <th>UHID / MR</th>
                <th>Admission</th>
                <th>Bill date</th>
                <th>Bill</th>
                {access !== 'ward' && <th className="right">Billed</th>}
                {access !== 'ward' && <th className="right">Patient resp.</th>}
                {(access === 'full' || access === 'finance') && <th className="right">Payer resp.</th>}
                {(access === 'full' || access === 'finance') && <th className="right">Collected</th>}
                <th className="right">Patient OS</th>
                {(access === 'full' || access === 'finance') && <th className="right">Payer OS</th>}
                <th>Status</th>
                {(access === 'full' || access === 'finance') && <th>Charge status</th>}
                {(access === 'full' || access === 'finance') && <th>Last txn</th>}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12} className="empty">Loading billing data…</td></tr>
              ) : displayRows(rows, access).length === 0 ? (
                <tr><td colSpan={12} className="empty">No inpatient bills in this range</td></tr>
              ) : displayRows(rows, access).map(r => (
                <tr
                  key={r.billId}
                  className={`clickable ${r.journeyId === focusJourneyId || r.billId === focusBillId ? 'row-selected' : ''}`}
                  onClick={() => openBill(r.billId)}
                >
                  <td><div className="cell-primary">{r.patientName}</div></td>
                  <td className="mono">{r.mrn ?? '—'}</td>
                  <td className="cell-sub">{fmtDate(r.admissionDate)}</td>
                  <td className="cell-sub">{fmtDate(r.billDate)}</td>
                  <td className="mono">{r.billNumber}</td>
                  {access !== 'ward' && <td className="num right">{fmtINR(r.billedAmount)}</td>}
                  {access !== 'ward' && <td className="num right">{fmtINR(r.patientResponsibility)}</td>}
                  {(access === 'full' || access === 'finance') && <td className="num right">{fmtINR(r.payerResponsibility)}</td>}
                  {(access === 'full' || access === 'finance') && <td className="num right">{fmtINR(r.collected)}</td>}
                  <td className="num right">
                    {r.patientOutstanding > 0 ? fmtINR(r.patientOutstanding) : <span className="badge ok">Nil</span>}
                  </td>
                  {(access === 'full' || access === 'finance') && (
                    <td className="num right">{fmtINR(r.payerOutstanding)}</td>
                  )}
                  <td>{r.lifecycle.replaceAll('_', ' ')}</td>
                  {(access === 'full' || access === 'finance') && (
                    <td>
                      <span className={`badge ${r.chargeStatus === 'complete' ? 'ok' : 'ot'}`}>
                        {r.chargeStatusLabel ?? 'Complete'}
                      </span>
                    </td>
                  )}
                  {(access === 'full' || access === 'finance') && <td className="cell-sub">{fmtDate(r.lastTransactionAt)}</td>}
                  <td>
                    <button type="button" onClick={(e) => { e.stopPropagation(); openBill(r.billId); }} className="btn sm">
                      Open Billing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}

function displayRows(rows: IpBillingDashboard['patients'], access: Access) {
  if (access === 'ward') return rows.filter(r => r.patientOutstanding > 0);
  return rows;
}

function reconciliationHref(data: IpBillingDashboard | null): string {
  if (!data?.fromUtc || !data?.toUtcExclusive) return '/dashboard/admin/charge-reconciliation';
  const qs = new URLSearchParams({ fromUtc: data.fromUtc, toUtc: data.toUtcExclusive });
  return `/dashboard/admin/charge-reconciliation?${qs.toString()}`;
}

const PAYER_COLORS = ['bg-slate-500', 'bg-indigo-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500'];
const INST_COLORS = ['bg-emerald-400', 'bg-blue-400', 'bg-violet-400', 'bg-cyan-400', 'bg-gray-300'];

function Bar({ segments }: { segments: { label: string; amount: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.amount, 0);
  if (total === 0) return <div className="h-3 bg-gray-100 rounded-full" />;
  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-3">
        {segments.map((seg, i) => (
          <div key={i} className={seg.color} style={{ width: `${(seg.amount / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`h-2 w-2 rounded-full ${seg.color}`} />
            {seg.label}
            <span className="text-gray-400">{fmtINR(seg.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
